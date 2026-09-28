import type { APIContext } from "astro";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, getDriveThruTemplate, recordDriveThruSent } from "@/utils/kv.ts";

export async function POST({ request, params }: APIContext): Promise<Response> {
  const creds = getCredentials();
  if (!creds) {
    return Response.json({ error: "Not configured" }, { status: 401 });
  }

  const orderId = Number(params.orderId);
  if (isNaN(orderId)) {
    return Response.json({ error: "Invalid order ID" }, { status: 400 });
  }

  let templateId: string | null = null;
  let templateName: string | null = null;
  try {
    const body = await request.json();
    templateId = body.templateId ?? null;
    if (templateId) {
      const template = await getDriveThruTemplate(templateId);
      templateName = template?.name ?? null;
    }
  } catch {
    // body parsing failed — proceed without template reference
  }

  try {
    const client = new BricklinkClient(creds);
    await client.sendDriveThru(orderId);

    const sentAt = new Date().toISOString();
    await recordDriveThruSent({ orderId, templateId, templateName, sentAt });

    return Response.json({ ok: true, sentAt });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
