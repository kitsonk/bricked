import type { APIContext } from "astro";
import { stringify, type Stringifyable } from "@libs/xml";

export async function POST({ request }: APIContext): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return new Response("Body must be a JSON object", { status: 400 });
  }
  try {
    const xml = stringify(body as Stringifyable);
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
  } catch (err) {
    return new Response(String(err), { status: 422 });
  }
}
