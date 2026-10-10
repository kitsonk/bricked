import { isAuthEnabled } from "@/utils/auth.ts";
import { isBotProbe, isExemptPath } from "@/utils/exemptPaths.ts";
import { getClientIp, isBanned, recordUnauth } from "@/utils/banlist.ts";
import { getLogger } from "@/utils/log.ts";
import type { RespondingMiddleware } from "@/middleware/types.ts";

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

export const banlist: RespondingMiddleware = async (context, next) => {
  const pathname = context.url.pathname;

  if (isBotProbe(pathname)) {
    // Fast 404 — never hit auth, KV, or downstream handlers for known junk paths.
    return probeResponse();
  }

  if (!isAuthEnabled()) {
    return await next();
  }

  if (isExemptPath(pathname)) {
    return await next();
  }

  const ip = getClientIp(context.request, context.clientAddress);
  if (!ip) {
    // Without a usable IP, do not record or block — let auth do its thing.
    return await next();
  }

  if (await isBanned(ip)) {
    logger.info("Banlist: blocked {ip} on {method} {path}", {
      ip,
      method: context.request.method,
      path: pathname,
    });
    return bannedResponse();
  }

  const res = await next();

  if (res.status === 401 || res.status === 302) {
    // Fire-and-forget — do not block the response on KV I/O.
    void recordUnauth(ip).catch((err) => {
      logger.error("Banlist: recordUnauth failed for {ip}: {err}", { ip, err: String(err) });
    });
  }

  return res;
};
