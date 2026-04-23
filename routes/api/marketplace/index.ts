import { define } from "@/utils/fresh.ts";
import { getBricklinkItemSearch, getColor, getCredentials, saveBricklinkItemSearch } from "@/utils/kv.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import type { BricklinkSearchResult } from "@/utils/types.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const itemid = ctx.url.searchParams.get("itemid");
    if (!itemid) {
      return Response.json({ error: "itemid is required" }, { status: 400 });
    }
    const itemtype = ctx.url.searchParams.get("itemtype") ?? "S";
    // colorid absent  → initial lookup: fetch marketplace + item colors
    // colorid="all"   → color cleared back to All: fetch marketplace only, skip colors
    // colorid=N (int) → specific color: fetch marketplace filtered by N (if N > 0), skip colors
    const coloridParam = ctx.url.searchParams.get("colorid");

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

    const colorIdNum = coloridParam && coloridParam !== "all" ? parseInt(coloridParam, 10) : null;
    if (colorIdNum !== null && colorIdNum > 0 && !isNaN(colorIdNum)) {
      marketplaceUrl.searchParams.set("color", String(colorIdNum));
    }

    // Only look up item colors on the initial search (no colorid param present).
    const creds = getCredentials();
    const colorsPromise = coloridParam === null && creds
      ? new BricklinkClient(creds).getItemColors(itemtype, itemid)
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

    let marketplaceResp: Response;
    let colors: { color_id: number; color_name: string }[];
    try {
      [marketplaceResp, colors] = await Promise.all([fetch(marketplaceUrl), colorsPromise]);
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 502 });
    }
    if (!marketplaceResp.ok) {
      return Response.json({ error: `Upstream HTTP ${marketplaceResp.status}` }, { status: 502 });
    }

    return Response.json({ ...await marketplaceResp.json(), colors });
  },
});
