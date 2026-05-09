import { define } from "@/utils/fresh.ts";
import { listTemplateRules, saveTemplateRule } from "@/utils/kv.ts";
import type { TemplateRule } from "@/utils/types.ts";

export const handler = define.handlers({
  async GET(_ctx) {
    const rules = await listTemplateRules();
    return Response.json(rules);
  },

  async POST(ctx) {
    const body = await ctx.req.json();
    const { name, templateId, conditions, priority } = body;
    if (!name?.trim() || !templateId?.trim()) {
      return Response.json({ error: "name and templateId are required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const rule: TemplateRule = {
      id: crypto.randomUUID(),
      name: name.trim(),
      templateId: templateId.trim(),
      conditions: Array.isArray(conditions) ? conditions : [],
      priority: typeof priority === "number" ? priority : 0,
      createdAt: now,
      updatedAt: now,
    };
    await saveTemplateRule(rule);
    return Response.json(rule, { status: 201 });
  },
});
