import type { APIContext } from "astro";
import { deleteDriveThruTemplate, getDriveThruTemplate, saveDriveThruTemplate } from "@/utils/kv.ts";

export async function PUT({ request, params }: APIContext): Promise<Response> {
  const id = params.id ?? "";
  const existing = await getDriveThruTemplate(id);
  if (!existing) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, body: templateBody } = body;
  if (!name?.trim() || !templateBody?.trim()) {
    return Response.json({ error: "name and body are required" }, { status: 400 });
  }

  const updated = { ...existing, name: name.trim(), body: templateBody, updatedAt: new Date().toISOString() };
  await saveDriveThruTemplate(updated);
  return Response.json(updated);
}

export async function DELETE({ params }: APIContext): Promise<Response> {
  await deleteDriveThruTemplate(params.id ?? "");
  return new Response(null, { status: 204 });
}
