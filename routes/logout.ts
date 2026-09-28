import type { APIContext } from "astro";
import { deleteCookie } from "@std/http/cookie";
import { AUTH_COOKIE } from "@/utils/auth.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "routes", "logout"]);

export function POST({ locals }: APIContext): Response {
  const headers = new Headers({ location: "/login" });
  deleteCookie(headers, AUTH_COOKIE, { path: "/" });
  if (locals.user) {
    logger.info`User "${locals.user.username}" signed out`;
  }
  return new Response(null, { status: 302, headers });
}

export function GET({ locals }: APIContext): Response {
  const headers = new Headers({ location: "/login" });
  deleteCookie(headers, AUTH_COOKIE, { path: "/" });
  if (locals.user) {
    logger.info`User "${locals.user.username}" signed out via GET`;
  }
  return new Response(null, { status: 302, headers });
}
