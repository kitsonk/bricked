import type { Context } from "fresh";
import { getCookies } from "@std/http/cookie";
import type { State } from "@/utils/fresh.ts";
import { AUTH_COOKIE, isAuthEnabled, verifySession } from "@/utils/auth.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "auth", "middleware"]);

const EXEMPT_PATHS: ReadonlySet<string> = new Set([
  "/login",
  "/api/notifications",
]);

const EXEMPT_PREFIXES: readonly string[] = [
  "/_frsh/",
  "/static/",
  "/assets/",
  "/favicon",
  "/logo",
];

const STATIC_EXTENSIONS = new Set([
  ".js",
  ".css",
  ".map",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".json",
  ".txt",
  ".webmanifest",
]);

function isExempt(pathname: string): boolean {
  if (EXEMPT_PATHS.has(pathname)) return true;
  for (const prefix of EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  const lastDot = pathname.lastIndexOf(".");
  const lastSlash = pathname.lastIndexOf("/");
  if (lastDot > lastSlash) {
    const ext = pathname.slice(lastDot);
    if (STATIC_EXTENSIONS.has(ext.toLowerCase())) return true;
  }
  return false;
}

export default function auth(): (ctx: Context<State>) => Promise<Response> {
  return async function authMiddleware(ctx: Context<State>): Promise<Response> {
    ctx.state.user = null;

    if (!isAuthEnabled()) {
      return await ctx.next();
    }

    const cookies = getCookies(ctx.req.headers);
    const token = cookies[AUTH_COOKIE];
    if (token) {
      const session = await verifySession(token);
      if (session) {
        ctx.state.user = { username: session.username };
        return await ctx.next();
      }
    }

    if (isExempt(ctx.url.pathname)) {
      return await ctx.next();
    }

    if (ctx.url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const from = ctx.url.pathname + ctx.url.search;
    const params = new URLSearchParams();
    if (from !== "/login") params.set("from", from);
    const query = params.toString();
    logger.info`Unauthenticated request blocked: ${ctx.req.method} ${ctx.url.pathname}`;
    return new Response(null, {
      status: 302,
      headers: { location: "/login" + (query ? "?" + query : "") },
    });
  };
}
