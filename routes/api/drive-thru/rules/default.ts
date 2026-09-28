import type { APIContext } from "astro";
import { getDefaultTemplateId, setDefaultTemplateId } from "@/utils/kv.ts";

export async function GET(): Promise<Response> {
  const id = await getDefaultTemplateId();
  return Response.json({ defaultTemplateId: id });
}

export async function PUT({ request }: APIContext): Promise<Response> {
  const body = await request.json();
  const { defaultTemplateId } = body;
  if (typeof defaultTemplateId !== "string" || !defaultTemplateId.trim()) {
    return Response.json({ error: "defaultTemplateId is required" }, { status: 400 });
  }
  await setDefaultTemplateId(defaultTemplateId.trim());
  return Response.json({ defaultTemplateId: defaultTemplateId.trim() });
}
