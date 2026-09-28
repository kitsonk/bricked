import { getCookies } from "@std/http/cookie";
import { AUTH_COOKIE, isAuthEnabled, verifySession } from "@/utils/auth.ts";
import { isExemptPath } from "@/utils/exemptPaths.ts";
import { getLogger } from "@/utils/log.ts";
import type { RespondingMiddleware } from "@/middleware/types.ts";

const logger = getLogger(["bricked", "auth", "middleware"]);

const ROBOTS_NOINDEX = "noindex, nofollow, noarchive, nosnippet";
const CACHE_PRIVATE = "no-store, no-cache, must-revalidate, private";
const REFERRER_POLICY = "no-referrer";

function applyDiscouragementHeaders(res: Response): Response {
  res.headers.set("x-robots-tag", ROBOTS_NOINDEX);
  res.headers.set("cache-control", CACHE_PRIVATE);
  res.headers.set("referrer-policy", REFERRER_POLICY);
  return res;
}

export const auth: RespondingMiddleware = async (context, next) => {
  context.locals.user = null;

  if (!isAuthEnabled()) {
    return applyDiscouragementHeaders(await next());
  }

  const cookies = getCookies(context.request.headers);
  const token = cookies[AUTH_COOKIE];
  if (token) {
    const session = await verifySession(token);
    if (session) {
      context.locals.user = { username: session.username };
      return applyDiscouragementHeaders(await next());
    }
  }

  if (isExemptPath(context.url.pathname)) {
    return applyDiscouragementHeaders(await next());
  }

  if (context.url.pathname.startsWith("/api/")) {
    logger.info`Unauthenticated API request blocked: ${context.request.method} ${context.url.pathname}`;
    const res = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "retry-after": "86400",
      },
    });
    return applyDiscouragementHeaders(res);
  }

  const from = context.url.pathname + context.url.search;
  const params = new URLSearchParams();
  if (from !== "/login") params.set("from", from);
  const query = params.toString();
  logger.info`Unauthenticated request blocked: ${context.request.method} ${context.url.pathname}`;
  const res = new Response(null, {
    status: 302,
    headers: { location: "/login" + (query ? "?" + query : "") },
  });
  return applyDiscouragementHeaders(res);
};
