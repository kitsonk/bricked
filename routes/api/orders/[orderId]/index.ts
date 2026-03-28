import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials } from "@/utils/kv.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) return Response.json({ error: "Not configured" }, { status: 401 });

    const orderId = Number(ctx.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return Response.json({ error: "Invalid order id" }, { status: 400 });
    }

    try {
      const client = new BricklinkClient(creds);
      const order = await client.getOrder(orderId);
      return Response.json(order);
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
});
