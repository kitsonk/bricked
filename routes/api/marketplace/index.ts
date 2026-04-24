import { define } from "@/utils/fresh.ts";
import { getBricklinkItemSearch, getColor, getCredentials, saveBricklinkItemSearch } from "@/utils/kv.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import type { BLCatalogItem, BLSubsetEntry, BricklinkSearchResult } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "marketplace"]);

const AJAX_HEADERS = {
  headers: {
    "accept": "application/json, text/javascript, */*; q=0.01",
    "accept-language": "en-AU,en-GB;q=0.9,en;q=0.8,en-US;q=0.7",
    "priority": "u=1, i",
    "sec-ch-ua": '"Microsoft Edge";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-requested-with": "XMLHttpRequest",
    "Referer": "https://www.bricklink.com/v2/catalog/catalogitem.page?M=njo0001",
  },
};

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
        searchResp = await fetch(searchUrl, AJAX_HEADERS);
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

    const storePromise: Promise<Response | null> = listOnly ? Promise.resolve(null) : fetch(
      (() => {
        const url = new URL("https://store.bricklink.com/ajax/clone/store/searchitems.ajax");
        url.searchParams.set("sid", "4245762");
        url.searchParams.set("itemID", String(idItem));
        if (colorIdNum !== null && colorIdNum > 0 && !isNaN(colorIdNum)) {
          url.searchParams.set("colorID", String(colorIdNum));
        }
        return url;
      })(),
      AJAX_HEADERS,
    );

    let marketplaceResp: Response;
    let storeResp: Response | null;
    let colors: { color_id: number; color_name: string }[];
    let catalogItem: BLCatalogItem | null;
    let imageUrl: string | null;
    let subsets: BLSubsetEntry[];
    try {
      [marketplaceResp, storeResp, colors, catalogItem, imageUrl, subsets] = await Promise.all([
        fetch(marketplaceUrl, AJAX_HEADERS),
        storePromise,
        colorsPromise,
        catalogItemPromise,
        imageUrlPromise,
        subsetsPromise,
      ]);
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 502 });
    }
    if (!marketplaceResp.ok) {
      return Response.json({ error: `Upstream HTTP ${marketplaceResp.status}` }, { status: 502 });
    }

    const storeJson = !listOnly && storeResp?.ok
      ? await storeResp.json() as { result?: { groups?: Array<{ items?: unknown[] }> } }
      : null;
    const storeItems = storeJson?.result?.groups?.[0]?.items ?? [];

    const partCount = subsets.length > 0 ? subsets.length : null;
    return Response.json({
      ...await marketplaceResp.json(),
      colors,
      catalogItem,
      imageUrl,
      partCount,
      idItem,
      ...(!listOnly && { storeItems }),
    });
  },
});
