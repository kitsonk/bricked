import type { Context } from "fresh";
import type { State } from "@/utils/fresh.ts";
import { isAuthEnabled } from "@/utils/auth.ts";
import { isBotProbe, isExemptPath } from "@/utils/exemptPaths.ts";
import { getClientIp, isBanned, recordUnauth } from "@/utils/banlist.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "banlist", "middleware"]);

const BAN_RESPONSE_HEADERS: Record<string, string> = {
  "content-type": "text/plain; charset=utf-8",
  "retry-after": "86400",
  "x-robots-tag": "noindex, nofollow",
  "cache-control": "no-store, no-cache, must-revalidate, private",
};

const PROBE_RESPONSE_HEADERS: Record<string, string> = {
  "content-type": "text/plain; charset=utf-8",
  "x-robots-tag": "noindex, nofollow",
  "cache-control": "no-store, no-cache, must-revalidate, private",
};

function bannedResponse(): Response {
  return new Response("Forbidden", { status: 403, headers: BAN_RESPONSE_HEADERS });
}

function probeResponse(): Response {
  return new Response("Not Found", { status: 404, headers: PROBE_RESPONSE_HEADERS });
}

export default function banlist(): (ctx: Context<State>) => Promise<Response> {
  return async function banlistMiddleware(ctx: Context<State>): Promise<Response> {
    const pathname = ctx.url.pathname;

    if (isBotProbe(pathname)) {
      // Fast 404 — never hit auth, KV, or downstream handlers for known junk paths.
      return probeResponse();
    }

    if (!isAuthEnabled()) {
      return await ctx.next();
    }

    if (isExemptPath(pathname)) {
      return await ctx.next();
    }

    const ip = getClientIp(ctx.req);
    if (!ip) {
      // Without a usable IP, do not record or block — let auth do its thing.
      return await ctx.next();
    }

    if (await isBanned(ip)) {
      logger.info("Banlist: blocked {ip} on {method} {path}", {
        ip,
        method: ctx.req.method,
        path: pathname,
      });
      return bannedResponse();
    }

    const res = await ctx.next();

    if (res.status === 401 || res.status === 302) {
      // Fire-and-forget — do not block the response on KV I/O.
      void recordUnauth(ip).catch((err) => {
        logger.error("Banlist: recordUnauth failed for {ip}: {err}", { ip, err: String(err) });
      });
    }

    return res;
  };
}
