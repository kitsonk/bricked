import { define } from "@/utils/fresh.ts";
import { saveShipListAddress } from "@/utils/kv.ts";
import type { AusPostAddress } from "@/utils/types.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const orderId = Number(ctx.params.orderId);
    if (isNaN(orderId)) return new Response("Bad Request", { status: 400 });
    const address: AusPostAddress = await ctx.req.json();
    await saveShipListAddress(orderId, address);
    return new Response(JSON.stringify(address), {
      headers: { "Content-Type": "application/json" },
    });
  },
});
