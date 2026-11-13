import type { APIContext } from "astro";
import {
  getBricklinkItemSearch,
  getColor,
  getCredentials,
  getMarketplaceCache,
  getStoreItemsCache,
  isMarketplaceCacheFresh,
  saveBricklinkItemSearch,
  saveMarketplaceCache,
  saveStoreItemsCache,
} from "@/utils/kv.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import type { BLCatalogItem, BLSubsetEntry, BricklinkSearchResult } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";
import { MARKETPLACE_PAGE_SIZE } from "@/utils/format.ts";
import {
  bricklinkAjaxHeaders,
  coalesced,
  fetchWithBackoff,
  isBricklinkAjaxCoolingDown,
} from "@/utils/bricklinkAjax.ts";

const logger = getLogger(["bricked", "marketplace"]);

/** Country scope for the marketplace listing fetch, and the cache partition that goes with it. */
const MARKETPLACE_LOC = "AU";

export async function GET({ url }: APIContext): Promise<Response> {
  const itemid = url.searchParams.get("itemid");
  if (!itemid) {
    return Response.json({ error: "itemid is required" }, { status: 400 });
  }
  const itemtype = url.searchParams.get("itemtype") ?? "S";
  // colorid absent  → initial lookup: fetch marketplace + item colors + catalog item
  // colorid="all"   → color cleared back to All: fetch marketplace only
  // colorid=N (int) → specific color: fetch marketplace filtered by N + color-specific image
  const coloridParam = url.searchParams.get("colorid");
  const colorIdNum = coloridParam && coloridParam !== "all" ? parseInt(coloridParam, 10) : null;
  const pageParam = parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  // list_only=true → page navigation: skip store + image fetches, return only marketplace listing data
  const listOnly = url.searchParams.get("list_only") === "true";

  // Phase 5: Resolve the internal BrickLink item ID; never fail the whole
  // request if the search endpoint is rate-limited or unreachable.
  let searchResult: BricklinkSearchResult | null = null;
  const cachedSearch = await getBricklinkItemSearch(itemid);
  if (cachedSearch) {
    searchResult = cachedSearch;
  } else if (isBricklinkAjaxCoolingDown()) {
    logger.debug`Search skipped for ${itemid}: bricklink ajax cooldown active`;
  } else {
    const searchUrl = new URL("https://www.bricklink.com/ajax/clone/search/searchproduct.ajax");
    searchUrl.searchParams.set("q", itemid);
    try {
      const json = await coalesced(`search:${itemid.toLowerCase()}`, async () => {
        const resp = await fetchWithBackoff(searchUrl, bricklinkAjaxHeaders(itemtype, itemid));
        if (!resp.ok) throw new Error(`Search upstream HTTP ${resp.status}`);
        return (await resp.json()) as BricklinkSearchResult;
      });
      if (json.returnCode === 0) {
        await saveBricklinkItemSearch(itemid, json);
        searchResult = json;
      }
    } catch (err) {
      logger.warn`Search fetch failed for ${itemid}: ${String(err)}`;
    }
  }

  const idItem = searchResult?.result?.typeList?.[0]?.items?.[0]?.idItem ?? null;

  const creds = getCredentials();
  const client = creds ? new BricklinkClient(creds) : null;
  const isInitial = coloridParam === null;

  // API-client calls (colors, catalog, subsets, image) are independent of
  // idItem and should succeed even when www.bricklink.com/ajax is throttled.
  const colorsPromise =
    isInitial && client
      ? client
          .getItemColors(itemtype, itemid)
          .then((itemColors) =>
            Promise.all(
              itemColors.map(async (ic) => {
                const kvColor = await getColor(ic.color_id);
                return { color_id: ic.color_id, color_name: kvColor?.color_name ?? ic.color_name };
              }),
            ),
          )
          .catch(() => [] as { color_id: number; color_name: string }[])
      : Promise.resolve([] as { color_id: number; color_name: string }[]);

  const catalogItemPromise: Promise<BLCatalogItem | null> =
    isInitial && client ? client.getCatalogItem(itemtype, itemid).catch(() => null) : Promise.resolve(null);

  const imageUrlPromise: Promise<string | null> =
    !listOnly && colorIdNum !== null && colorIdNum > 0 && client
      ? client
          .getItemImage(itemtype, itemid, colorIdNum)
          .then((img) => img.thumbnail_url ?? null)
          .catch((err) => {
            logger.warn`getItemImage failed for ${itemtype}/${itemid} color ${colorIdNum}: ${String(err)}`;
            return null;
          })
      : Promise.resolve(null);

  const subsetsPromise: Promise<BLSubsetEntry[]> =
    isInitial && client && (itemtype === "S" || itemtype === "M")
      ? client.getSubsets(itemtype, itemid).catch(() => [])
      : Promise.resolve([]);

  // Phase 1: Marketplace listings – catch everything so a 429/403/non-ok
  // response never bubbles up and kills the API-client data.
  const marketplacePromise = (async () => {
    if (!idItem) {
      return {
        data: { list: [], total_count: 0 } as Record<string, unknown>,
        error: "Item not found" as string | null,
        stale: false,
        staleAt: null as string | null,
      };
    }
    const cached = await getMarketplaceCache(idItem, colorIdNum, page, MARKETPLACE_LOC);
    if (cached && isMarketplaceCacheFresh(cached.savedAt)) {
      logger.debug`Marketplace cache hit (fresh) for ${itemid} color=${colorIdNum ?? "all"} page=${page}`;
      return {
        data: cached.data as Record<string, unknown>,
        error: null as string | null,
        stale: false,
        staleAt: null as string | null,
      };
    }
    let upstreamError: string | null = null;
    let upstreamData: Record<string, unknown> | null = null;
    if (isBricklinkAjaxCoolingDown()) {
      logger.debug`Marketplace skipped for ${itemid}: bricklink ajax cooldown active`;
      upstreamError = "BrickLink ajax endpoint cooling down; upstream skipped";
    } else {
      const marketplaceUrl = new URL("https://www.bricklink.com/ajax/clone/catalogifs.ajax");
      marketplaceUrl.searchParams.set("itemid", String(idItem));
      marketplaceUrl.searchParams.set("loc", MARKETPLACE_LOC);
      marketplaceUrl.searchParams.set("rpp", String(MARKETPLACE_PAGE_SIZE));
      marketplaceUrl.searchParams.set("pi", String(page));
      if (colorIdNum !== null && colorIdNum > 0 && !Number.isNaN(colorIdNum)) {
        marketplaceUrl.searchParams.set("color", String(colorIdNum));
      }
      try {
        upstreamData = await coalesced(`marketplace:${idItem}:${colorIdNum ?? "all"}:${page}`, async () => {
          const resp = await fetchWithBackoff(marketplaceUrl, bricklinkAjaxHeaders(itemtype, itemid));
          if (!resp.ok) throw new Error(`Upstream HTTP ${resp.status}`);
          return (await resp.json()) as Record<string, unknown>;
        });
      } catch (err) {
        upstreamError = String(err);
        logger.warn`Marketplace fetch failed for ${itemid}: ${upstreamError}`;
      }
    }
    if (upstreamData !== null) {
      await saveMarketplaceCache(idItem, colorIdNum, page, MARKETPLACE_LOC, upstreamData);
      return {
        data: upstreamData,
        error: null as string | null,
        stale: false,
        staleAt: null as string | null,
      };
    }
    if (cached) {
      return {
        data: cached.data as Record<string, unknown>,
        error: upstreamError as string | null,
        stale: true,
        staleAt: cached.savedAt,
      };
    }
    return {
      data: { list: [], total_count: 0 } as Record<string, unknown>,
      error: upstreamError as string | null,
      stale: false,
      staleAt: null as string | null,
    };
  })();

  // Phase 2: Store items – fetch the store's own lots through the official
  // BrickLink Store API. The store.bricklink.com scrape is WAF-blocked for
  // server-side fetch (needs browser session cookies + aws-waf-token).
  const storePromise = listOnly
    ? Promise.resolve(null)
    : (async () => {
        if (!client) return [];
        try {
          const cached = await getStoreItemsCache(itemtype, itemid, colorIdNum);
          if (cached) {
            logger.debug`Store items cache hit for ${itemid} color=${colorIdNum ?? "all"}`;
            return cached;
          }
          const inventories = await client.getStoreInventories(
            itemtype,
            colorIdNum && colorIdNum > 0 ? colorIdNum : undefined,
          );
          const items = inventories
            .filter((inv) => inv.item.no.toLowerCase() === itemid.toLowerCase())
            .map((inv) => ({
              invQty: inv.quantity,
              nativePrice: `AU ${parseFloat(inv.unit_price).toFixed(2)}`,
              invNew: inv.new_or_used === "N" ? "New" : "Used",
              invDescription: inv.description,
            }));
          await saveStoreItemsCache(itemtype, itemid, colorIdNum, items);
          return items;
        } catch (err) {
          logger.warn`Store fetch failed for ${itemid}: ${String(err)}`;
          return [];
        }
      })();

  let marketplaceResult: {
    data: Record<string, unknown>;
    error: string | null;
    stale: boolean;
    staleAt: string | null;
  };
  let storeItems: unknown[] | null;
  let colors: { color_id: number; color_name: string }[];
  let catalogItem: BLCatalogItem | null;
  let imageUrl: string | null;
  let subsets: BLSubsetEntry[];

  try {
    [marketplaceResult, storeItems, colors, catalogItem, imageUrl, subsets] = await Promise.all([
      marketplacePromise,
      storePromise,
      colorsPromise,
      catalogItemPromise,
      imageUrlPromise,
      subsetsPromise,
    ]);
  } catch (err) {
    // Safety net – every promise above is now self-catch()ing, so this
    // branch is effectively unreachable, but kept for defence in depth.
    return Response.json({ error: String(err) }, { status: 502 });
  }

  const partCount =
    subsets.length > 0 ? subsets.reduce((sum, s) => sum + s.entries.reduce((n, e) => n + e.quantity, 0), 0) : null;

  // Phase 3: Return everything we have; include marketplaceError so the UI
  // can show a helpful message without losing the catalog/colors data.
  return Response.json({
    ...marketplaceResult.data,
    colors,
    catalogItem,
    imageUrl,
    partCount,
    idItem,
    pageSize: MARKETPLACE_PAGE_SIZE,
    ...(marketplaceResult.error ? { marketplaceError: marketplaceResult.error } : {}),
    ...(marketplaceResult.stale ? { marketplaceStale: true, marketplaceStaleAt: marketplaceResult.staleAt } : {}),
    ...(!listOnly && storeItems != null ? { storeItems } : {}),
  });
}
