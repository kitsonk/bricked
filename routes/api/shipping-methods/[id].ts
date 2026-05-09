import { define } from "@/utils/fresh.ts";
import { saveShippingMethodEnrichment } from "@/utils/kv.ts";
import type { ShippingMethodEnrichment } from "@/utils/types.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const methodId = Number(ctx.params.id);
    if (!Number.isInteger(methodId) || methodId <= 0) {
      return Response.json({ error: "Invalid method id" }, { status: 400 });
    }
    const body = await ctx.req.json();
    if (typeof body.hasTracking !== "boolean" || typeof body.printLabel !== "boolean") {
      return Response.json({ error: "hasTracking and printLabel (boolean) are required" }, { status: 400 });
    }
    const enrichment: ShippingMethodEnrichment = { hasTracking: body.hasTracking, printLabel: body.printLabel };
    await saveShippingMethodEnrichment(methodId, enrichment);
    return Response.json(enrichment);
  },
});
