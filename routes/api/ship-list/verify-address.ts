import type { APIContext } from "astro";
import { verifyAustralianAddress } from "@/utils/addressfinder.ts";
import type { AusPostAddress } from "@/utils/types.ts";

export async function POST({ request }: APIContext): Promise<Response> {
  const address: AusPostAddress = await request.json();
  try {
    const result = await verifyAustralianAddress(address);
    if (!result) {
      return new Response(JSON.stringify({ matched: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        matched: true,
        addressLine1: result.addressLine1,
        addressLine2: result.addressLine2 ?? "",
        addressLine3: result.addressLine3 ?? "",
        suburb: result.suburb,
        state: result.state,
        postcode: result.postcode,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
