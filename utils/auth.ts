import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "auth"]);

export const AUTH_COOKIE = "bricked_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface AuthConfig {
  username: string;
  password: string;
  sessionSecret: string;
}

export interface SessionPayload {
  username: string;
  issuedAt: number;
}

let cachedConfig: AuthConfig | null | undefined;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256(key: string, data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return new Uint8Array(sig);
}

/**
 * Read auth configuration from the environment. Returns `null` (and logs a
 * single warning on first call) if any of APP_USERNAME, APP_PASSWORD, or
 * SESSION_SECRET are missing — in which case authentication is disabled.
 */
export function getAuthConfig(): AuthConfig | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }
  const username = Deno.env.get("APP_USERNAME");
  const password = Deno.env.get("APP_PASSWORD");
  const sessionSecret = Deno.env.get("SESSION_SECRET");
  if (!username || !password || !sessionSecret) {
    logger.warn(
      "APP_USERNAME, APP_PASSWORD, or SESSION_SECRET is not set — authentication is disabled.",
    );
    cachedConfig = null;
    return null;
  }
  cachedConfig = { username, password, sessionSecret };
  return cachedConfig;
}

/** True when all required env vars are present and auth gating is active. */
export function isAuthEnabled(): boolean {
  return getAuthConfig() !== null;
}

/**
 * Constant-time check of a submitted password against the configured one.
 * Returns false if auth is disabled.
 */
export function verifyCredentials(submittedUsername: string, submittedPassword: string): boolean {
  const config = getAuthConfig();
  if (!config) return false;
  const usernameOk = constantTimeEqual(submittedUsername, config.username);
  const passwordOk = constantTimeEqual(submittedPassword, config.password);
  return usernameOk && passwordOk;
}

/** Sign a session payload and return a base64url token suitable for a cookie value. */
export async function signSession(username: string): Promise<string> {
  const config = getAuthConfig();
  if (!config) throw new Error("signSession called while auth is disabled");
  const issuedAt = Date.now();
  const body = `${username}.${issuedAt}`;
  const bodyEncoded = bytesToBase64Url(new TextEncoder().encode(body));
  const sig = await hmacSha256(config.sessionSecret, bodyEncoded);
  return `${bodyEncoded}.${bytesToBase64Url(sig)}`;
}

/**
 * Verify a session token. Returns the payload on success, `null` on any
 * failure (bad signature, malformed token, expired).
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  const config = getAuthConfig();
  if (!config) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const bodyEncoded = token.slice(0, dot);
  const sigEncoded = token.slice(dot + 1);
  let sigBytes: Uint8Array;
  let bodyBytes: Uint8Array;
  try {
    sigBytes = base64UrlToBytes(sigEncoded);
    bodyBytes = base64UrlToBytes(bodyEncoded);
  } catch {
    return null;
  }
  const expectedSig = await hmacSha256(config.sessionSecret, bodyEncoded);
  if (sigBytes.length !== expectedSig.length) return null;
  if (
    !constantTimeEqual(
      String.fromCharCode(...sigBytes),
      String.fromCharCode(...expectedSig),
    )
  ) {
    return null;
  }
  let body: string;
  try {
    body = new TextDecoder().decode(bodyBytes);
  } catch {
    return null;
  }
  const sep = body.lastIndexOf(".");
  if (sep < 0) return null;
  const username = body.slice(0, sep);
  const issuedAtStr = body.slice(sep + 1);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SESSION_MAX_AGE_SECONDS * 1000) return null;
  return { username, issuedAt };
}

/** Test-only: clear the memoised config so env-var stubs take effect. */
export function _resetAuthConfigForTesting(): void {
  cachedConfig = undefined;
}
