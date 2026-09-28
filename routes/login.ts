import type { APIContext } from "astro";
import { setCookie } from "@std/http/cookie";
import {
  AUTH_COOKIE,
  getAuthConfig,
  isAuthEnabled,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifyCredentials,
} from "@/utils/auth.ts";
import { getLogger } from "@/utils/log.ts";
import type { PageResult } from "@/routes/pageResult.ts";

const logger = getLogger(["bricked", "routes", "login"]);

export type LoginData = {
  error: string | null;
  from: string;
  username: string;
  authDisabled: boolean;
};

const SAFE_FROM = /^\/[^/].*$/;

function sanitizeFrom(raw: string | null): string {
  if (!raw) return "/";
  if (raw === "/login") return "/";
  if (!SAFE_FROM.test(raw)) return "/";
  return raw;
}

export function loginGet({ locals, url }: APIContext): PageResult<LoginData> {
  if (locals.user) {
    return { kind: "response", response: new Response(null, { status: 302, headers: { location: "/" } }) };
  }
  const from = sanitizeFrom(url.searchParams.get("from"));
  return { kind: "data", data: { error: null, from, username: "", authDisabled: !isAuthEnabled() } };
}

export async function loginPost({ request, url }: APIContext): Promise<PageResult<LoginData>> {
  const form = await request.formData();
  const submittedUsername = String(form.get("username") ?? "");
  const submittedPassword = String(form.get("password") ?? "");
  const from = sanitizeFrom(String(form.get("from") ?? "/"));

  const config = getAuthConfig();
  if (!config) {
    logger.warn`Login attempt while auth is disabled`;
    return { kind: "response", response: new Response(null, { status: 302, headers: { location: from } }) };
  }

  const ok = verifyCredentials(submittedUsername, submittedPassword);
  if (!ok) {
    logger.info`Failed login attempt for user "${submittedUsername}"`;
    return { kind: "data", data: { error: "Invalid username or password.", from, username: "", authDisabled: false } };
  }

  const token = await signSession(config.username);
  const headers = new Headers({ location: from });
  setCookie(headers, {
    name: AUTH_COOKIE,
    value: token,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: url.protocol === "https:",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  logger.info`User "${config.username}" signed in`;
  return { kind: "response", response: new Response(null, { status: 302, headers }) };
}
