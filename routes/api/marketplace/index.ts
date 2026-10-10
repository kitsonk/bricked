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
import { bricklinkCatalogUrl, MARKETPLACE_PAGE_SIZE } from "@/utils/format.ts";

const logger = getLogger(["bricked", "marketplace"]);

function bricklinkAjaxHeaders(itemType: string, itemNo: string, site: "same-origin" | "same-site" = "same-origin") {
  return {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-AU,en;q=0.9",
      priority: "u=1, i",
      referer: bricklinkCatalogUrl(itemType, itemNo),
      "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": site,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    },
  };
}

export function computeBackoffDelay(
  attempt: number,
  retryAfterSec: number | null,
  jitterMs = Math.random() * 1000,
): number {
  const retryMs = retryAfterSec !== null && Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : 0;
  return Math.min(Math.max(retryMs, 2000 * 2 ** attempt), 30000) + jitterMs;
}

const BRICKLINK_AJAX_COOLDOWN_MS = 60_000;
let bricklinkAjaxCoolUntilMs = 0;

/** True while the bricklink.com/ajax host is in a cooldown window after a recent 429/403. */
export function isBricklinkAjaxCoolingDown(nowMs = Date.now()): boolean {
  return nowMs < bricklinkAjaxCoolUntilMs;
}

/** Put the bricklink.com/ajax host into a cooldown window after observing a 429/403. */
export function noteBricklinkAjaxThrottle(nowMs = Date.now()): void {
  bricklinkAjaxCoolUntilMs = nowMs + BRICKLINK_AJAX_COOLDOWN_MS;
}

async function fetchWithBackoff(url: URL, init: RequestInit, maxAttempts = 3): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(url, init);
    } catch (err) {
      if (attempt + 1 >= maxAttempts) throw err;
      const delayMs = computeBackoffDelay(attempt, null);
      logger.warn`Fetch to ${url.pathname} failed (attempt ${attempt + 1}), retrying: ${String(err)}`;
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, delayMs);
      await promise;
      continue;
    }
    if (resp.status === 403) {
      noteBricklinkAjaxThrottle();
      logger.warn`Got 403 from ${url.pathname}; not retrying (WAF block)`;
      return resp;
    }
    if (resp.status !== 429) return resp;
    noteBricklinkAjaxThrottle();
    if (attempt + 1 >= maxAttempts) {
      logger.warn`Got 429 from ${url.pathname} on final attempt; returning 429 to caller`;
      return resp;
    }
    const retryAfterRaw = parseInt(resp.headers.get("retry-after") ?? "", 10);
    const retryAfterSec = Number.isNaN(retryAfterRaw) || retryAfterRaw < 0 ? null : retryAfterRaw;
    const delayMs = computeBackoffDelay(attempt, retryAfterSec);
    logger.warn`Got 429 from ${url.pathname} on attempt ${attempt + 1}, retrying after ${Math.round(delayMs)}ms`;
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, delayMs);
    await promise;
  }
}

const inflightUpstream = new Map<string, Promise<unknown>>();

/** Deduplicate concurrent upstream fetches for the same key (double-clicks, color/page races). */
async function coalesced<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflightUpstream.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn();
  inflightUpstream.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightUpstream.delete(key);
  }
}

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
    const cached = await getMarketplaceCache(idItem, colorIdNum, page);
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
      marketplaceUrl.searchParams.set("loc", "AU");
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
      await saveMarketplaceCache(idItem, colorIdNum, page, upstreamData);
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
