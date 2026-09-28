import type { APIContext } from "astro";
import { deleteTemplateRule, getTemplateRule, saveTemplateRule } from "@/utils/kv.ts";
import type { TemplateRule } from "@/utils/types.ts";

export async function GET({ params }: APIContext): Promise<Response> {
  const rule = await getTemplateRule(params.id ?? "");
  if (!rule) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(rule);
}

export async function PUT({ request, params }: APIContext): Promise<Response> {
  const id = params.id ?? "";
  const existing = await getTemplateRule(id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
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
}

export async function DELETE({ params }: APIContext): Promise<Response> {
  await deleteTemplateRule(params.id ?? "");
  return new Response(null, { status: 204 });
}
