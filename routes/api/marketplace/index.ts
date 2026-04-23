import { define } from "@/utils/fresh.ts";
import { getBricklinkItemSearch, getColor, getCredentials, saveBricklinkItemSearch } from "@/utils/kv.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import type { BLCatalogItem, BricklinkSearchResult } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "marketplace"]);

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

    // Resolve the internal BrickLink item ID, using KV cache if available.
    let searchResult = await getBricklinkItemSearch(itemid);
    if (!searchResult) {
      const searchUrl = new URL("https://www.bricklink.com/ajax/clone/search/searchproduct.ajax");
      searchUrl.searchParams.set("q", itemid);
      let searchResp: Response;
      try {
        searchResp = await fetch(searchUrl);
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

    const imageUrlPromise: Promise<string | null> = colorIdNum !== null && colorIdNum > 0 && client
      ? client.getItemImage(itemtype, itemid, colorIdNum)
        .then((img) => img.thumbnail_url ?? null)
        .catch((err) => {
          logger.warn`getItemImage failed for ${itemtype}/${itemid} color ${colorIdNum}: ${String(err)}`;
          return null;
        })
      : Promise.resolve(null);

    let marketplaceResp: Response;
    let colors: { color_id: number; color_name: string }[];
    let catalogItem: BLCatalogItem | null;
    let imageUrl: string | null;
    try {
      [marketplaceResp, colors, catalogItem, imageUrl] = await Promise.all([
        fetch(marketplaceUrl),
        colorsPromise,
        catalogItemPromise,
        imageUrlPromise,
      ]);
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 502 });
    }
    if (!marketplaceResp.ok) {
      return Response.json({ error: `Upstream HTTP ${marketplaceResp.status}` }, { status: 502 });
    }

    return Response.json({ ...await marketplaceResp.json(), colors, catalogItem, imageUrl });
  },
});
