import { stringify, type stringifyable } from "@libs/xml";
import { define } from "@/utils/fresh.ts";

export const handler = define.handlers({
  async POST(ctx) {
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return new Response("Body must be a JSON object", { status: 400 });
    }
    try {
      const xml = stringify(body as stringifyable);
      return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
    } catch (err) {
      return new Response(String(err), { status: 422 });
    }
  },
});
