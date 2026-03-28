import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials } from "@/utils/kv.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const creds = getCredentials();
    if (!creds) return Response.json({ error: "Not configured" }, { status: 401 });

    const orderId = Number(ctx.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return Response.json({ error: "Invalid order id" }, { status: 400 });
    }

    const body = await ctx.req.json();
    const { dateShipped, trackingNo, trackingLink } = body;
    if (!dateShipped) {
      return Response.json({ error: "dateShipped is required" }, { status: 400 });
    }

    try {
      const client = new BricklinkClient(creds);
      await client.updateOrderStatus(orderId, "SHIPPED");
      await client.updateOrderShipping(orderId, {
        date_shipped: new Date(dateShipped).toISOString(),
        tracking_no: trackingNo ?? "",
        tracking_link: trackingLink ?? "",
      });
      return Response.json({ ok: true });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
});
