import type { APIContext } from "astro";
import { getSenderAddress, saveSenderAddress } from "@/utils/kv.ts";
import type { AusPostAddress } from "@/utils/types.ts";

export async function GET(): Promise<Response> {
  const address = await getSenderAddress();
  return Response.json(address);
}

export async function PUT({ request }: APIContext): Promise<Response> {
  const body = await request.json();

  const fields = ["recipientName", "addressLine1", "addressLine2", "addressLine3", "suburb", "state", "postcode"];
  for (const field of fields) {
    if (typeof body[field] !== "string") {
      return Response.json({ error: `Missing or invalid field: ${field}` }, { status: 400 });
    }
  }

  const address: AusPostAddress = {
    recipientName: body.recipientName.trim(),
    addressLine1: body.addressLine1.trim(),
    addressLine2: body.addressLine2.trim(),
    addressLine3: body.addressLine3.trim(),
    suburb: body.suburb.trim(),
    state: body.state.trim(),
    postcode: body.postcode.trim(),
  };

  await saveSenderAddress(address);
  return Response.json(address);
}
