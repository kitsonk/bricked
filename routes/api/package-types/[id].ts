import { define } from "@/utils/fresh.ts";
import { deletePackageType, getPackageType, savePackageType } from "@/utils/kv.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const { id } = ctx.params;
    const existing = await getPackageType(id);
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    const body = await ctx.req.json();
    const { label, lengthCm, widthCm, heightCm } = body;
    if (!label || typeof lengthCm !== "number" || typeof widthCm !== "number" || typeof heightCm !== "number") {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }
    const updated = {
      ...existing,
      label: String(label).trim(),
      lengthCm: Math.round(lengthCm * 10) / 10,
      widthCm: Math.round(widthCm * 10) / 10,
      heightCm: Math.round(heightCm * 10) / 10,
      updatedAt: new Date().toISOString(),
    };
    await savePackageType(updated);
    return Response.json(updated);
  },

  async DELETE(ctx) {
    const { id } = ctx.params;
    await deletePackageType(id);
    return new Response(null, { status: 204 });
  },
});
