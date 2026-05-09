import { define } from "@/utils/fresh.ts";
import { deleteTemplateRule, getTemplateRule, saveTemplateRule } from "@/utils/kv.ts";
import type { TemplateRule } from "@/utils/types.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const rule = await getTemplateRule(ctx.params.id);
    if (!rule) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(rule);
  },

  async PUT(ctx) {
    const existing = await getTemplateRule(ctx.params.id);
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = await ctx.req.json();
    const { name, templateId, conditions, priority } = body;
    if (!name?.trim() || !templateId?.trim()) {
      return Response.json({ error: "name and templateId are required" }, { status: 400 });
    }

    const updated: TemplateRule = {
      ...existing,
      name: name.trim(),
      templateId: templateId.trim(),
      conditions: Array.isArray(conditions) ? conditions : existing.conditions,
      priority: typeof priority === "number" ? priority : existing.priority,
      updatedAt: new Date().toISOString(),
    };
    await saveTemplateRule(updated);
    return Response.json(updated);
  },

  async DELETE(ctx) {
    await deleteTemplateRule(ctx.params.id);
    return new Response(null, { status: 204 });
  },
});
