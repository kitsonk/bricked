import { define } from "@/utils/fresh.ts";
import {
  getBricklinkItemSearch,
  getColor,
  getCredentials,
  getMarketplaceCache,
  getStoreItemsCache,
  saveBricklinkItemSearch,
  saveMarketplaceCache,
  saveStoreItemsCache,
} from "@/utils/kv.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import type { BLCatalogItem, BLSubsetEntry, BricklinkSearchResult } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";
import { bricklinkCatalogUrl, MARKETPLACE_PAGE_SIZE } from "@/utils/format.ts";

const logger = getLogger(["bricked", "marketplace"]);

function bricklinkAjaxHeaders(
  itemType: string,
  itemNo: string,
  site: "same-origin" | "same-site" = "same-origin",
) {
  return {
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-AU,en;q=0.9",
      "origin": "https://www.bricklink.com",
      "priority": "u=1, i",
      "referer": bricklinkCatalogUrl(itemType, itemNo),
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

async function fetchWithRetry(url: URL, init: RequestInit): Promise<Response> {
  const resp = await fetch(url, init);
  if (resp.status === 403) {
    logger.debug`Got 403 from ${url.pathname}, retrying after 2s`;
    await new Promise((r) => setTimeout(r, 2000));
    return fetch(url, init);
  }
  return resp;
}

export const handler = define.handlers({
  async GET(ctx) {
    const itemid = ctx.url.searchParams.get("itemid");
    if (!itemid) {
      return Response.json({ error: "itemid is required" }, { status: 400 });
    }
    const itemtype = ctx.url.searchParams.get("itemtype") ?? "S";
    // colorid absent  → initial lookup: fetch marketplace + item colors + catalog item
    // colorid="all"   → color cleared back to All: fetch marketplace only
    // colorid=N (int) → specific color: fetch marketplace filtered by N + color-specific image
    const coloridParam = ctx.url.searchParams.get("colorid");
    const colorIdNum = coloridParam && coloridParam !== "all" ? parseInt(coloridParam, 10) : null;
    const pageParam = parseInt(ctx.url.searchParams.get("page") ?? "1", 10);
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    // list_only=true → page navigation: skip store + image fetches, return only marketplace listing data
    const listOnly = ctx.url.searchParams.get("list_only") === "true";

    // Phase 5: Resolve the internal BrickLink item ID; never fail the whole
    // request if the search endpoint is rate-limited or unreachable.
    let searchResult: BricklinkSearchResult | null = null;
    const cachedSearch = await getBricklinkItemSearch(itemid);
    if (cachedSearch) {
      searchResult = cachedSearch;
    } else {
      const searchUrl = new URL("https://www.bricklink.com/ajax/clone/search/searchproduct.ajax");
      searchUrl.searchParams.set("q", itemid);
      try {
        const searchResp = await fetchWithRetry(searchUrl, bricklinkAjaxHeaders(itemtype, itemid));
        if (searchResp.ok) {
          const json = await searchResp.json() as BricklinkSearchResult;
          if (json.returnCode === 0) {
            await saveBricklinkItemSearch(itemid, json);
            searchResult = json;
          }
        } else {
          logger.warn`Search upstream HTTP ${searchResp.status} for ${itemid}`;
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
    const colorsPromise = isInitial && client
      ? client.getItemColors(itemtype, itemid)
        .then((itemColors) =>
          Promise.all(
            itemColors.map(async (ic) => {
              const kvColor = await getColor(ic.color_id);
              return { color_id: ic.color_id, color_name: kvColor?.color_name ?? ic.color_name };
            }),
          )
        )
        .catch(() => [] as { color_id: number; color_name: string }[])
      : Promise.resolve([] as { color_id: number; color_name: string }[]);

    const catalogItemPromise: Promise<BLCatalogItem | null> = isInitial && client
      ? client.getCatalogItem(itemtype, itemid).catch(() => null)
      : Promise.resolve(null);

    const imageUrlPromise: Promise<string | null> = !listOnly && colorIdNum !== null && colorIdNum > 0 && client
      ? client.getItemImage(itemtype, itemid, colorIdNum)
        .then((img) => img.thumbnail_url ?? null)
        .catch((err) => {
          logger.warn`getItemImage failed for ${itemtype}/${itemid} color ${colorIdNum}: ${String(err)}`;
          return null;
        })
      : Promise.resolve(null);

    const subsetsPromise: Promise<BLSubsetEntry[]> = isInitial && client &&
        (itemtype === "S" || itemtype === "M")
      ? client.getSubsets(itemtype, itemid).catch(() => [])
      : Promise.resolve([]);

    // Phase 1: Marketplace listings – catch everything so a 429/403/non-ok
    // response never bubbles up and kills the API-client data.
    const marketplacePromise = (async () => {
      if (!idItem) {
        return {
          data: { list: [], total_count: 0 } as Record<string, unknown>,
          error: "Item not found" as string | null,
        };
      }
      try {
        const cached = await getMarketplaceCache(idItem, colorIdNum, page);
        if (cached) {
          logger.debug`Marketplace cache hit for ${itemid} color=${colorIdNum ?? "all"} page=${page}`;
          return { data: cached as Record<string, unknown>, error: null as string | null };
        }
        const marketplaceUrl = new URL("https://www.bricklink.com/ajax/clone/catalogifs.ajax");
        marketplaceUrl.searchParams.set("itemid", String(idItem));
        marketplaceUrl.searchParams.set("loc", "AU");
        marketplaceUrl.searchParams.set("rpp", String(MARKETPLACE_PAGE_SIZE));
        marketplaceUrl.searchParams.set("pi", String(page));
        if (colorIdNum !== null && colorIdNum > 0 && !isNaN(colorIdNum)) {
          marketplaceUrl.searchParams.set("color", String(colorIdNum));
        }
        const resp = await fetchWithRetry(marketplaceUrl, bricklinkAjaxHeaders(itemtype, itemid));
        if (!resp.ok) {
          throw new Error(`Upstream HTTP ${resp.status}`);
        }
        const data = await resp.json();
        await saveMarketplaceCache(idItem, colorIdNum, page, data);
        return { data: data as Record<string, unknown>, error: null as string | null };
      } catch (err) {
        logger.warn`Marketplace fetch failed for ${itemid}: ${String(err)}`;
        return { data: { list: [], total_count: 0 } as Record<string, unknown>, error: String(err) as string | null };
      }
    })();

    // Phase 2: Store items – fully resilient to network and HTTP errors.
    const storePromise = listOnly ? Promise.resolve(null) : (async () => {
      if (!idItem) return [];
      try {
        const cached = await getStoreItemsCache(idItem, colorIdNum);
        if (cached) {
          logger.debug`Store items cache hit for ${itemid} color=${colorIdNum ?? "all"}`;
          return cached;
        }
        const storeUrl = new URL("https://store.bricklink.com/ajax/clone/store/searchitems.ajax");
        storeUrl.searchParams.set("sid", "4245762");
        storeUrl.searchParams.set("itemID", String(idItem));
        if (colorIdNum !== null && colorIdNum > 0 && !isNaN(colorIdNum)) {
          storeUrl.searchParams.set("colorID", String(colorIdNum));
        }
        const resp = await fetchWithRetry(storeUrl, bricklinkAjaxHeaders(itemtype, itemid, "same-site"));
        if (!resp.ok) {
          logger.debug`Store search returned HTTP ${resp.status} for ${itemid}, returning empty`;
          return [];
        }
        const json = await resp.json() as { result?: { groups?: Array<{ items?: unknown[] }> } };
        const items = json?.result?.groups?.[0]?.items ?? [];
        await saveStoreItemsCache(idItem, colorIdNum, items);
        return items;
      } catch (err) {
        logger.warn`Store fetch failed for ${itemid}: ${String(err)}`;
        return [];
      }
    })();

    let marketplaceResult: { data: Record<string, unknown>; error: string | null };
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

    const partCount = subsets.length > 0
      ? subsets.reduce((sum, s) => sum + s.entries.reduce((n, e) => n + e.quantity, 0), 0)
      : null;

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
      ...(!listOnly && storeItems != null ? { storeItems } : {}),
    });
  },
});
