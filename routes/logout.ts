import { deleteCookie } from "@std/http/cookie";
import { define } from "@/utils/fresh.ts";
import { AUTH_COOKIE } from "@/utils/auth.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "routes", "logout"]);

export const handler = define.handlers({
  POST(ctx) {
    const headers = new Headers({ location: "/login" });
    deleteCookie(headers, AUTH_COOKIE, { path: "/" });
    if (ctx.state.user) {
      logger.info`User "${ctx.state.user.username}" signed out`;
    }
    return new Response(null, { status: 302, headers });
  },
  GET(ctx) {
    const headers = new Headers({ location: "/login" });
    deleteCookie(headers, AUTH_COOKIE, { path: "/" });
    if (ctx.state.user) {
      logger.info`User "${ctx.state.user.username}" signed out via GET`;
    }
    return new Response(null, { status: 302, headers });
  },
});
