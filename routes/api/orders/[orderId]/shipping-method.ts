import { define } from "@/utils/fresh.ts";
import { saveShippingOverride } from "@/utils/kv.ts";
import type { LocalShippingOverride } from "@/utils/types.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const orderId = Number(ctx.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return Response.json({ error: "Invalid order id" }, { status: 400 });
    }

    const body = await ctx.req.json();
    const { methodId, methodName } = body;

    if (
      typeof methodId !== "number" ||
      !Number.isInteger(methodId) ||
      methodId <= 0 ||
      typeof methodName !== "string" ||
      methodName.trim() === ""
    ) {
      return Response.json({ error: "methodId (positive integer) and methodName (non-empty string) are required" }, {
        status: 400,
      });
    }

    const override: LocalShippingOverride = {
      methodId,
      methodName: methodName.trim(),
      updatedAt: new Date().toISOString(),
    };

    await saveShippingOverride(orderId, override);
    return Response.json(override);
  },
});
