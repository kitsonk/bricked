import type { APIContext } from "astro";
import { listDriveThruTemplates, saveDriveThruTemplate } from "@/utils/kv.ts";
import type { DriveThruTemplate } from "@/utils/types.ts";

export async function GET(): Promise<Response> {
  const templates = await listDriveThruTemplates();
  return Response.json(templates);
}

export async function POST({ request }: APIContext): Promise<Response> {
  const body = await request.json();
  const { name, body: templateBody } = body;
  if (!name?.trim() || !templateBody?.trim()) {
    return Response.json({ error: "name and body are required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const template: DriveThruTemplate = {
    id: crypto.randomUUID(),
    name: name.trim(),
    body: templateBody,
    createdAt: now,
    updatedAt: now,
  };
  await saveDriveThruTemplate(template);
  return Response.json(template, { status: 201 });
}
