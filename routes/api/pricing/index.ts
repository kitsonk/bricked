import type { APIContext } from "astro";
import { BricklinkClient } from "@/utils/bricklink.ts";
import {
  bricklinkAjaxHeaders,
  coalesced,
  fetchWithBackoff,
  isBricklinkAjaxCoolingDown,
} from "@/utils/bricklinkAjax.ts";
import {
  getBricklinkItemSearch,
  getColor,
  getCredentials,
  getMarketplaceCache,
  getPriceGuideCache,
  getPricingSettings,
  isMarketplaceCacheFresh,
  isPriceGuideCacheFresh,
  saveBricklinkItemSearch,
  saveMarketplaceCache,
  savePriceGuideCache,
} from "@/utils/kv.ts";
import { convertToAnalysis, median, normalizeStoreSlug, parseNativePrice, suggestPrice } from "@/utils/pricing.ts";
import type { TierStoreInput } from "@/utils/pricing.ts";
import type {
  BLCatalogItem,
  BLPriceGuide,
  BricklinkSearchResult,
  CatalogIfsListing,
  PricingSettings,
} from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";
import { MARKETPLACE_PAGE_SIZE } from "@/utils/format.ts";

const logger = getLogger(["bricked", "pricing"]);

/** Enough pages to see the market floor without hammering the upstream endpoint. */
const MAX_PRICING_PAGES = 4;
/** Cheapest rows used to estimate the market floor. */
const FLOOR_SAMPLE_SIZE = 25;

export interface PricingStoreRow {
  tier: "premium" | "mid" | "competitive";
  slug: string;
  name: string | null;
  /** Analysis currency; null when the store has no matching lots. */
  price: number | null;
  /** Sum of matched-lot quantities used in the analysis. */
  qty: number;
  lots: number;
  /** Matched lots dropped because their currency has no configured exchange rate. */
  excludedLots: number;
}

export interface PricingAnalysisResponse {
  item: { no: string; type: string; name: string | null };
  catalogItem: BLCatalogItem | null;
  /** Colour-specific thumbnail when a colour is selected, otherwise null. */
  imageUrl: string | null;
  partCount: number | null;
  colorId: number | null;
  condition: "N" | "U";
  ownQty: number;
  colors: { color_id: number; color_name: string }[];
  stores: PricingStoreRow[];
  tierPrices: { premium: number | null; mid: number | null; competitive: number | null };
  market: {
    /** catalogifs total_count for item + colour, all conditions. */
    lotsForSale: number | null;
    /** Distinct sellers across the fetched pages. */
    sellersSeen: number | null;
    /** The market floor price the algorithm used. */
    floorPrice: number | null;
    /** Median of every fetched condition-matched lot. */
    medianPrice: number | null;
    stock: BLPriceGuide | null;
  };
  history: {
    sold: BLPriceGuide | null;
    monthly: { month: string; qty: number; avgPrice: number }[];
  };
  suggestion: {
    price: number;
    bandLow: number;
    bandHigh: number;
    breakdown: {
      blend: number;
      uplift: number;
      highCap: number | null;
      floorCapApplied: boolean;
      floorCap: number | null;
    };
  } | null;
  warnings: string[];
  stale: boolean;
  staleAt: string | null;
}

type TierName = "premium" | "mid" | "competitive";
const TIER_NAMES: readonly TierName[] = ["premium", "mid", "competitive"];

type ListingPage = {
  rows: CatalogIfsListing[];
  totalCount: number | null;
  stale: boolean;
  staleAt: string | null;
  error: string | null;
};

function parseListingPage(data: unknown): { rows: CatalogIfsListing[]; totalCount: number | null } {
  if (typeof data !== "object" || data === null) return { rows: [], totalCount: null };
  const record = data as { list?: unknown; total_count?: unknown };
  const rows = Array.isArray(record.list) ? (record.list as CatalogIfsListing[]) : [];
  const totalCount = typeof record.total_count === "number" ? record.total_count : null;
  return { rows, totalCount };
}

async function fetchListingPage(
  idItem: number,
  itemType: string,
  itemNo: string,
  colorId: number | null,
  page: number,
  loc: string,
): Promise<ListingPage> {
  const cached = await getMarketplaceCache(idItem, colorId, page, loc);
  if (cached && isMarketplaceCacheFresh(cached.savedAt)) {
    const parsed = parseListingPage(cached.data);
    return { ...parsed, stale: false, staleAt: null, error: null };
  }

  let upstreamError: string | null = null;
  if (isBricklinkAjaxCoolingDown()) {
    upstreamError = "BrickLink ajax endpoint cooling down; upstream skipped";
  } else {
    const url = new URL("https://www.bricklink.com/ajax/clone/catalogifs.ajax");
    url.searchParams.set("itemid", String(idItem));
    url.searchParams.set("rpp", String(MARKETPLACE_PAGE_SIZE));
    url.searchParams.set("pi", String(page));
    if (loc) url.searchParams.set("loc", loc);
    if (colorId !== null) url.searchParams.set("color", String(colorId));
    try {
      const json = await coalesced(`marketplace:${idItem}:${colorId ?? "all"}:${page}:${loc}`, async () => {
        const resp = await fetchWithBackoff(url, bricklinkAjaxHeaders(itemType, itemNo));
        if (!resp.ok) throw new Error(`Upstream HTTP ${resp.status}`);
        return (await resp.json()) as unknown;
      });
      await saveMarketplaceCache(idItem, colorId, page, loc, json);
      const parsed = parseListingPage(json);
      return { ...parsed, stale: false, staleAt: null, error: null };
    } catch (err) {
      upstreamError = String(err);
      logger.warn`Marketplace page fetch failed for ${itemNo} page ${page}: ${upstreamError}`;
    }
  }

  if (cached) {
    const parsed = parseListingPage(cached.data);
    return { ...parsed, stale: true, staleAt: cached.savedAt, error: upstreamError };
  }
  return { rows: [], totalCount: null, stale: false, staleAt: null, error: upstreamError };
}

async function loadPriceGuide(
  client: BricklinkClient | null,
  itemType: string,
  itemNo: string,
  colorId: number | null,
  condition: "N" | "U",
  guideType: "stock" | "sold",
  settings: PricingSettings,
  warnings: string[],
): Promise<BLPriceGuide | null> {
  const cached = await getPriceGuideCache(
    itemType,
    itemNo,
    colorId,
    condition,
    guideType,
    settings.marketCountry,
    settings.analysisCurrency,
  );
  if (cached && isPriceGuideCacheFresh(cached.savedAt)) return cached.guide;
  if (!client) return cached?.guide ?? null;
  try {
    const guide = await client.getPriceGuide(itemType, itemNo, {
      colorId: colorId ?? undefined,
      guideType,
      newOrUsed: condition,
      countryCode: settings.marketCountry || undefined,
      currencyCode: settings.analysisCurrency,
    });
    await savePriceGuideCache(
      itemType,
      itemNo,
      colorId,
      condition,
      guideType,
      settings.marketCountry,
      settings.analysisCurrency,
      guide,
    );
    return guide;
  } catch (err) {
    logger.warn`Price guide (${guideType}) failed for ${itemNo}: ${String(err)}`;
    warnings.push(`BrickLink ${guideType} price guide unavailable — market statistics are partial`);
    return cached?.guide ?? null;
  }
}

/** Resolve the internal BrickLink item ID from cache or the catalogue search endpoint. */
async function resolveIdItem(
  itemNo: string,
  itemType: string,
  warnings: string[],
): Promise<{ idItem: number | null; name: string | null }> {
  const cached = await getBricklinkItemSearch(itemNo);
  const firstItem = cached?.result?.typeList?.[0]?.items?.[0] ?? null;
  if (firstItem) return { idItem: firstItem.idItem, name: firstItem.strItemName ?? null };

  if (isBricklinkAjaxCoolingDown()) {
    warnings.push("BrickLink catalogue search cooling down — competitor listings not refreshed");
    return { idItem: null, name: null };
  }

  const searchUrl = new URL("https://www.bricklink.com/ajax/clone/search/searchproduct.ajax");
  searchUrl.searchParams.set("q", itemNo);
  try {
    const json = await coalesced(`search:${itemNo.toLowerCase()}`, async () => {
      const resp = await fetchWithBackoff(searchUrl, bricklinkAjaxHeaders(itemType, itemNo));
      if (!resp.ok) throw new Error(`Search upstream HTTP ${resp.status}`);
      return (await resp.json()) as BricklinkSearchResult;
    });
    if (json.returnCode === 0) {
      await saveBricklinkItemSearch(itemNo, json);
      const item = json.result?.typeList?.[0]?.items?.[0] ?? null;
      return { idItem: item?.idItem ?? null, name: item?.strItemName ?? null };
    }
    return { idItem: null, name: null };
  } catch (err) {
    logger.warn`Search fetch failed for ${itemNo}: ${String(err)}`;
    warnings.push("BrickLink item lookup failed — competitor data may be missing");
    return { idItem: null, name: null };
  }
}

export async function GET({ url }: APIContext): Promise<Response> {
  const itemno = (url.searchParams.get("itemno") ?? "").trim();
  if (!itemno) return Response.json({ error: "itemno is required" }, { status: 400 });

  const itemtype = (url.searchParams.get("itemtype") ?? "P").toUpperCase();
  if (!["P", "S", "M"].includes(itemtype)) {
    return Response.json({ error: "itemtype must be one of P, S, M" }, { status: 400 });
  }

  const colorParam = url.searchParams.get("color");
  const parsedColor = colorParam === null ? null : Number.parseInt(colorParam, 10);
  if (parsedColor !== null && (!Number.isInteger(parsedColor) || parsedColor <= 0)) {
    return Response.json({ error: "color must be a positive integer" }, { status: 400 });
  }
  const colorId = parsedColor;

  const colorsOnly = url.searchParams.get("colors_only") === "1";
  const creds = getCredentials();
  const client = creds ? new BricklinkClient(creds) : null;

  const colorsPromise: Promise<{ color_id: number; color_name: string }[]> = client
    ? client
        .getItemColors(itemtype, itemno)
        .then(async (itemColors) => {
          // The item-colours endpoint omits `color_name`; fall back to the KV colour
          // cache, then to the full palette so the selector is never blank.
          const needsPalette = itemColors.some((ic) => !ic.color_name);
          const palette = needsPalette ? await client.getColors().catch(() => []) : [];
          const paletteNames = new Map(palette.map((color) => [color.color_id, color.color_name]));
          return Promise.all(
            itemColors.map(async (ic) => {
              const kvColor = await getColor(ic.color_id);
              return {
                color_id: ic.color_id,
                color_name:
                  kvColor?.color_name ?? ic.color_name ?? paletteNames.get(ic.color_id) ?? `Colour ${ic.color_id}`,
              };
            }),
          );
        })
        .catch(() => [] as { color_id: number; color_name: string }[])
    : Promise.resolve([] as { color_id: number; color_name: string }[]);

  if (colorsOnly) {
    return Response.json({ colors: await colorsPromise });
  }

  // Catalogue overview data for the item card; independent of the listing fetch.
  const catalogItemPromise: Promise<BLCatalogItem | null> = client
    ? client.getCatalogItem(itemtype, itemno).catch(() => null)
    : Promise.resolve(null);
  const imageUrlPromise: Promise<string | null> =
    client && colorId !== null
      ? client
          .getItemImage(itemtype, itemno, colorId)
          .then((img) => img.thumbnail_url ?? null)
          .catch(() => null)
      : Promise.resolve(null);
  const subsetsPromise =
    client && (itemtype === "S" || itemtype === "M")
      ? client.getSubsets(itemtype, itemno).catch(() => [])
      : Promise.resolve([]);

  const qtyRaw = url.searchParams.get("qty");
  const ownQty = qtyRaw === null ? Number.NaN : Number.parseInt(qtyRaw, 10);
  if (!Number.isInteger(ownQty) || ownQty < 1) {
    return Response.json({ error: "qty must be an integer of at least 1" }, { status: 400 });
  }

  const conditionRaw = (url.searchParams.get("cond") ?? "U").toUpperCase();
  if (conditionRaw !== "N" && conditionRaw !== "U") {
    return Response.json({ error: "cond must be N or U" }, { status: 400 });
  }
  const condition: "N" | "U" = conditionRaw;

  const [settings, colors] = await Promise.all([getPricingSettings(), colorsPromise]);
  if (!settings) {
    return Response.json({ error: "Configure pricing store tiers in Configuration first" }, { status: 400 });
  }
  const configuredSlugs = TIER_NAMES.flatMap((tier) => settings.tiers[tier] ?? [])
    .map(normalizeStoreSlug)
    .filter(Boolean);
  if (configuredSlugs.length === 0) {
    return Response.json({ error: "Configure pricing store tiers in Configuration first" }, { status: 400 });
  }

  const warnings: string[] = [];
  const slugSet = new Set(configuredSlugs);
  if (colorId === null) warnings.push("Colour not specified — prices mix all colours");

  const { idItem, name: itemName } = await resolveIdItem(itemno, itemtype, warnings);

  // Phase 1: competitor listings.
  const rows: CatalogIfsListing[] = [];
  const pageErrors = new Set<string>();
  const matchedSlugs = new Set<string>();
  let lotsForSale: number | null = null;
  let stale = false;
  let staleAt: string | null = null;
  let conditionMatched = 0;
  const loc = settings.marketCountry || "";

  if (idItem === null) {
    warnings.push("Item not found on BrickLink");
  } else {
    for (let page = 1; page <= MAX_PRICING_PAGES; page++) {
      const result = await fetchListingPage(idItem, itemtype, itemno, colorId, page, loc);
      if (page === 1 && result.totalCount !== null) lotsForSale = result.totalCount;
      rows.push(...result.rows);
      if (result.stale) {
        stale = true;
        staleAt = staleAt ?? result.staleAt;
      }
      if (result.error) pageErrors.add(result.error);
      if (result.error && result.rows.length === 0) break;

      for (const row of result.rows) {
        if (String(row?.codeNew).toUpperCase() !== condition) continue;
        conditionMatched++;
        matchedSlugs.add(normalizeStoreSlug(row.strSellerUsername ?? ""));
      }

      if (result.rows.length === 0) break;
      if (matchedSlugs.intersection(slugSet).size === slugSet.size && conditionMatched >= FLOOR_SAMPLE_SIZE) break;
      if (result.totalCount !== null && page * MARKETPLACE_PAGE_SIZE >= result.totalCount) break;
    }
    for (const error of pageErrors) warnings.push(`Competitor listings: ${error}`);
    if (rows.length === 0 && idItem !== null) warnings.push("Competitor listings unavailable");
  }

  // Phase 2: map listings into configured tiers.
  const tiers = { premium: [] as TierStoreInput[], mid: [] as TierStoreInput[], competitive: [] as TierStoreInput[] };
  const stores: PricingStoreRow[] = [];
  const excludedByCode = new Map<string, number>();

  for (const tier of TIER_NAMES) {
    for (const rawSlug of settings.tiers[tier] ?? []) {
      const slug = normalizeStoreSlug(rawSlug);
      if (!slug) continue;
      const prices: number[] = [];
      let name: string | null = null;
      let qty = 0;
      let lots = 0;
      let excludedLots = 0;

      for (const row of rows) {
        if (String(row?.codeNew).toUpperCase() !== condition) continue;
        if (normalizeStoreSlug(row.strSellerUsername ?? "") !== slug) continue;
        lots++;
        name ??= row.strStorename ?? null;
        const native = parseNativePrice(row.mInvSalePrice) ?? parseNativePrice(row.mDisplaySalePrice);
        const price = native ? convertToAnalysis(native.amount, native.code, settings) : null;
        if (price === null || !Number.isFinite(price)) {
          excludedLots++;
          const code = native?.code ?? "unknown";
          excludedByCode.set(code, (excludedByCode.get(code) ?? 0) + 1);
          continue;
        }
        prices.push(price);
        qty += Number(row.n4Qty) || 0;
      }

      tiers[tier].push({
        slug,
        name,
        lots: prices.map((price) => ({ price, qty: 1 })),
        excludedLots,
      });
      stores.push({
        tier,
        slug,
        name,
        price: prices.length > 0 ? median(prices) : null,
        qty,
        lots,
        excludedLots,
      });
      if (prices.length === 0 && excludedLots === 0) {
        warnings.push(`No matching ${condition === "N" ? "new" : "used"} lots from ${slug}`);
      }
    }
  }

  for (const [code, count] of excludedByCode) {
    warnings.push(
      code === "unknown"
        ? `${count} lot${count === 1 ? "" : "s"} excluded — unreadable price`
        : `${count} lot${count === 1 ? "" : "s"} excluded — no exchange rate for ${code}`,
    );
  }

  const tierPrices = Object.fromEntries(
    TIER_NAMES.map((tier) => {
      const prices = inputPrices(tier, stores);
      return [tier, prices.length > 0 ? median(prices) : null];
    }),
  );

  // Phase 3: market statistics from every fetched condition-matched lot.
  const marketPrices: number[] = [];
  const sellers = new Set<string>();
  for (const row of rows) {
    sellers.add(normalizeStoreSlug(row.strSellerUsername ?? ""));
    if (String(row?.codeNew).toUpperCase() !== condition) continue;
    const native = parseNativePrice(row.mInvSalePrice) ?? parseNativePrice(row.mDisplaySalePrice);
    const price = native ? convertToAnalysis(native.amount, native.code, settings) : null;
    if (price !== null && Number.isFinite(price)) marketPrices.push(price);
  }
  const sortedMarketPrices = [...marketPrices].sort((a, b) => a - b);
  const floorPrice = sortedMarketPrices.length > 0 ? median(sortedMarketPrices.slice(0, FLOOR_SAMPLE_SIZE)) : null;
  const medianMarketPrice = sortedMarketPrices.length > 0 ? median(sortedMarketPrices) : null;

  // Phase 4: official price guides (stock + 6-month sold history).
  const [stockGuide, soldGuide] = await Promise.all([
    loadPriceGuide(client, itemtype, itemno, colorId, condition, "stock", settings, warnings),
    loadPriceGuide(client, itemtype, itemno, colorId, condition, "sold", settings, warnings),
  ]);

  const [catalogItem, imageUrl, subsets] = await Promise.all([catalogItemPromise, imageUrlPromise, subsetsPromise]);
  const partCount =
    subsets.length > 0 ? subsets.reduce((sum, s) => sum + s.entries.reduce((n, e) => n + e.quantity, 0), 0) : null;

  const monthly = monthlyHistory(soldGuide);
  const soldQty6mo = soldGuide?.total_quantity ?? null;

  const suggestion = suggestPrice({
    ownQty,
    tiers,
    marketFloorPrice: floorPrice,
    soldQty6mo,
  });
  if (suggestion === null && idItem !== null) {
    warnings.push("No competitor lots matched — no price suggestion available");
  }

  const response: PricingAnalysisResponse = {
    item: { no: itemno, type: itemtype, name: itemName },
    catalogItem,
    imageUrl,
    partCount,
    colorId,
    condition,
    ownQty,
    colors,
    stores,
    tierPrices: {
      premium: tierPrices.premium ?? null,
      mid: tierPrices.mid ?? null,
      competitive: tierPrices.competitive ?? null,
    },
    market: {
      lotsForSale,
      sellersSeen: rows.length > 0 ? sellers.size : null,
      floorPrice,
      medianPrice: medianMarketPrice,
      stock: stockGuide,
    },
    history: { sold: soldGuide, monthly },
    suggestion,
    warnings,
    stale,
    staleAt,
  };
  return Response.json(response);
}

function inputPrices(tier: TierName, stores: PricingStoreRow[]): number[] {
  return stores.filter((store) => store.tier === tier && store.price !== null).map((store) => store.price as number);
}

function monthlyHistory(sold: BLPriceGuide | null): { month: string; qty: number; avgPrice: number }[] {
  const buckets = new Map<string, { qty: number; total: number }>();
  for (const detail of sold?.price_detail ?? []) {
    const month = detail.date_ordered?.slice(0, 7);
    if (!month) continue;
    const price = Number.parseFloat(detail.unit_price);
    if (!Number.isFinite(price)) continue;
    const qty = Number(detail.quantity) || 0;
    const bucket = buckets.get(month) ?? { qty: 0, total: 0 };
    bucket.qty += qty;
    bucket.total += price * qty;
    buckets.set(month, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => ({
      month,
      qty: bucket.qty,
      avgPrice: bucket.qty > 0 ? Math.round((bucket.total / bucket.qty) * 100) / 100 : 0,
    }));
}
