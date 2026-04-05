import { define } from "@/utils/fresh.ts";
import { getBuyerIndex } from "@/utils/kv.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const q = ctx.url.searchParams.get("q")?.trim() ?? "";
    const index = await getBuyerIndex();
    if (!q) {
      return Response.json(index);
    }
    const lower = q.toLowerCase();
    const matches = index.filter((name) => name.toLowerCase().includes(lower));
    return Response.json(matches);
  },
});
