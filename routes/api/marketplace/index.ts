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
import { bricklinkCatalogUrl } from "@/utils/format.ts";

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

    // Resolve the internal BrickLink item ID, using KV cache if available.
    let searchResult = await getBricklinkItemSearch(itemid);
    if (!searchResult) {
      const searchUrl = new URL("https://www.bricklink.com/ajax/clone/search/searchproduct.ajax");
      searchUrl.searchParams.set("q", itemid);
      let searchResp: Response;
      try {
        searchResp = await fetchWithRetry(searchUrl, bricklinkAjaxHeaders(itemtype, itemid));
      } catch (err) {
        return Response.json({ error: String(err) }, { status: 502 });
      }
      if (!searchResp.ok) {
        return Response.json({ error: `Search upstream HTTP ${searchResp.status}` }, { status: 502 });
      }
      const json = await searchResp.json() as BricklinkSearchResult;
      if (json.returnCode === 0) {
        await saveBricklinkItemSearch(itemid, json);
      }
      searchResult = json;
    }

    const idItem = searchResult.result?.typeList?.[0]?.items?.[0]?.idItem;
    if (!idItem) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    const marketplaceUrl = new URL("https://www.bricklink.com/ajax/clone/catalogifs.ajax");
    marketplaceUrl.searchParams.set("itemid", String(idItem));
    marketplaceUrl.searchParams.set("loc", "AU");
    marketplaceUrl.searchParams.set("rpp", "10");
    marketplaceUrl.searchParams.set("pi", String(page));
    if (colorIdNum !== null && colorIdNum > 0 && !isNaN(colorIdNum)) {
      marketplaceUrl.searchParams.set("color", String(colorIdNum));
    }

    const creds = getCredentials();
    const client = creds ? new BricklinkClient(creds) : null;
    const isInitial = coloridParam === null;

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

    const marketplacePromise = (async () => {
      const cached = await getMarketplaceCache(idItem, colorIdNum, page);
      if (cached) {
        logger.debug`Marketplace cache hit for ${itemid} color=${colorIdNum ?? "all"} page=${page}`;
        return cached;
      }
      const resp = await fetchWithRetry(marketplaceUrl, bricklinkAjaxHeaders(itemtype, itemid));
      if (!resp.ok) {
        throw new Error(`Upstream HTTP ${resp.status}`);
      }
      const data = await resp.json();
      await saveMarketplaceCache(idItem, colorIdNum, page, data);
      return data;
    })();

    const storePromise = listOnly ? Promise.resolve(null) : (async () => {
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
    })();

    let marketplaceData: unknown;
    let storeItems: unknown[] | null;
    let colors: { color_id: number; color_name: string }[];
    let catalogItem: BLCatalogItem | null;
    let imageUrl: string | null;
    let subsets: BLSubsetEntry[];

    try {
      [marketplaceData, storeItems, colors, catalogItem, imageUrl, subsets] = await Promise.all([
        marketplacePromise,
        storePromise,
        colorsPromise,
        catalogItemPromise,
        imageUrlPromise,
        subsetsPromise,
      ]);
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 502 });
    }

    const partCount = subsets.length > 0
      ? subsets.reduce((sum, s) => sum + s.entries.reduce((n, e) => n + e.quantity, 0), 0)
      : null;

    return Response.json({
      ...(marketplaceData as Record<string, unknown>),
      colors,
      catalogItem,
      imageUrl,
      partCount,
      idItem,
      ...(!listOnly && storeItems != null ? { storeItems } : {}),
    });
  },
});
