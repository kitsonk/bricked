import { define } from "@/utils/fresh.ts";
import { getBricklinkItemSearch, saveBricklinkItemSearch } from "@/utils/kv.ts";
import type { BricklinkSearchResult } from "@/utils/types.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const itemid = ctx.url.searchParams.get("itemid");
    if (!itemid) {
      return Response.json({ error: "itemid is required" }, { status: 400 });
    }

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
    let resp: Response;
    try {
      resp = await fetch(marketplaceUrl);
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 502 });
    }
    if (!resp.ok) {
      return Response.json({ error: `Upstream HTTP ${resp.status}` }, { status: 502 });
    }
    return Response.json(await resp.json());
  },
});
