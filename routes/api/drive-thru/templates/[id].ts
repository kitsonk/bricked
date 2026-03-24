import { define } from "@/utils/fresh.ts";
import { deleteDriveThruTemplate, getDriveThruTemplate, saveDriveThruTemplate } from "@/utils/kv.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const { id } = ctx.params;
    const existing = await getDriveThruTemplate(id);
    if (!existing) {
      return Response.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await ctx.req.json();
    const { name, body: templateBody } = body;
    if (!name?.trim() || !templateBody?.trim()) {
      return Response.json({ error: "name and body are required" }, { status: 400 });
    }

    const updated = { ...existing, name: name.trim(), body: templateBody, updatedAt: new Date().toISOString() };
    await saveDriveThruTemplate(updated);
    return Response.json(updated);
  },

  async DELETE(ctx) {
    const { id } = ctx.params;
    await deleteDriveThruTemplate(id);
    return new Response(null, { status: 204 });
  },
});
