import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials } from "@/utils/kv.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return Response.json({ error: "Not configured" }, { status: 401 });
    }
    const orderId = Number(ctx.params.orderId);
    if (isNaN(orderId)) {
      return Response.json({ error: "Invalid order ID" }, { status: 400 });
    }
    let status: string;
    try {
      const body = await ctx.req.json();
      status = body.status;
      if (!status) throw new Error("Missing status");
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    try {
      const client = new BricklinkClient(creds);
      await client.updateOrderStatus(orderId, status);
      return Response.json({ ok: true });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
});
