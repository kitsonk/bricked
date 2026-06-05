import type { Context } from "fresh";
import { getCookies } from "@std/http/cookie";
import type { State } from "@/utils/fresh.ts";
import { AUTH_COOKIE, isAuthEnabled, verifySession } from "@/utils/auth.ts";
import { isExemptPath } from "@/utils/exemptPaths.ts";
import { getLogger } from "@/utils/log.ts";

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

export default function auth(): (ctx: Context<State>) => Promise<Response> {
  return async function authMiddleware(ctx: Context<State>): Promise<Response> {
    ctx.state.user = null;

    if (!isAuthEnabled()) {
      return applyDiscouragementHeaders(await ctx.next());
    }

    const cookies = getCookies(ctx.req.headers);
    const token = cookies[AUTH_COOKIE];
    if (token) {
      const session = await verifySession(token);
      if (session) {
        ctx.state.user = { username: session.username };
        return applyDiscouragementHeaders(await ctx.next());
      }
    }

    if (isExemptPath(ctx.url.pathname)) {
      return applyDiscouragementHeaders(await ctx.next());
    }

    if (ctx.url.pathname.startsWith("/api/")) {
      logger.info`Unauthenticated API request blocked: ${ctx.req.method} ${ctx.url.pathname}`;
      const res = new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
          "retry-after": "86400",
        },
      });
      return applyDiscouragementHeaders(res);
    }

    const from = ctx.url.pathname + ctx.url.search;
    const params = new URLSearchParams();
    if (from !== "/login") params.set("from", from);
    const query = params.toString();
    logger.info`Unauthenticated request blocked: ${ctx.req.method} ${ctx.url.pathname}`;
    const res = new Response(null, {
      status: 302,
      headers: { location: "/login" + (query ? "?" + query : "") },
    });
    return applyDiscouragementHeaders(res);
  };
}
