import type { APIContext } from "astro";
import { saveShipListAddress } from "@/utils/kv.ts";
import type { AusPostAddress } from "@/utils/types.ts";

export async function PUT({ request, params }: APIContext): Promise<Response> {
  const orderId = Number(params.orderId);
  if (Number.isNaN(orderId)) return new Response("Bad Request", { status: 400 });
  const address: AusPostAddress = await request.json();
  await saveShipListAddress(orderId, address);
  return new Response(JSON.stringify(address), {
    headers: { "Content-Type": "application/json" },
  });
}
