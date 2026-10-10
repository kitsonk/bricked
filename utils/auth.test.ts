import { assert, expect, test } from "vitest";
import {
  _resetAuthConfigForTesting,
  AUTH_COOKIE,
  getAuthConfig,
  isAuthEnabled,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifyCredentials,
  verifySession,
} from "@/utils/auth.ts";

const USERNAME = "admin";
const PASSWORD = "s3cret-passw0rd";
const SECRET = "test-session-secret-do-not-use-in-prod";

function setEnv(overrides: Partial<Record<"APP_USERNAME" | "APP_PASSWORD" | "SESSION_SECRET", string | undefined>>) {
  const keys = ["APP_USERNAME", "APP_PASSWORD", "SESSION_SECRET"] as const;
  for (const key of keys) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) process.env[key] = value;
  }
  _resetAuthConfigForTesting();
}

test("auth: AUTH_COOKIE is bricked_session", () => {
  expect(AUTH_COOKIE).toEqual("bricked_session");
});

test("auth: SESSION_MAX_AGE_SECONDS is 30 days", () => {
  expect(SESSION_MAX_AGE_SECONDS).toEqual(60 * 60 * 24 * 30);
});

test("getAuthConfig: returns null when any required env var is missing", () => {
  setEnv({});
  expect(getAuthConfig()).toEqual(null);
  expect(isAuthEnabled()).toEqual(false);

  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD });
  expect(getAuthConfig()).toEqual(null);

  setEnv({ APP_USERNAME: USERNAME, SESSION_SECRET: SECRET });
  expect(getAuthConfig()).toEqual(null);

  setEnv({ APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  expect(getAuthConfig()).toEqual(null);
});

test("getAuthConfig: returns the config when all env vars are set", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const config = getAuthConfig();
  assert(config);
  expect(config.username).toEqual(USERNAME);
  expect(config.password).toEqual(PASSWORD);
  expect(config.sessionSecret).toEqual(SECRET);
  expect(isAuthEnabled()).toEqual(true);
});

test("verifyCredentials: returns false when auth is disabled", () => {
  setEnv({});
  const ok = verifyCredentials(USERNAME, PASSWORD);
  expect(ok).toEqual(false);
});

test("verifyCredentials: accepts the correct username and password", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  expect(verifyCredentials(USERNAME, PASSWORD)).toEqual(true);
});

test("verifyCredentials: rejects the wrong password", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  expect(verifyCredentials(USERNAME, "wrong")).toEqual(false);
});

test("verifyCredentials: rejects the wrong username", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  expect(verifyCredentials("not-admin", PASSWORD)).toEqual(false);
});

test("verifyCredentials: rejects empty submissions", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  expect(verifyCredentials("", "")).toEqual(false);
  expect(verifyCredentials(USERNAME, "")).toEqual(false);
  expect(verifyCredentials("", PASSWORD)).toEqual(false);
});

test("signSession + verifySession: roundtrip succeeds", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);
  const session = await verifySession(token);
  assert(session);
  expect(session.username).toEqual(USERNAME);
  assert(session.issuedAt > 0);
  assert(session.issuedAt <= Date.now());
});

test("signSession: throws when auth is disabled", async () => {
  setEnv({});
  await expect(signSession(USERNAME)).rejects.toThrow();
});

test("verifySession: rejects a tampered body", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);
  const dot = token.indexOf(".");
  // Flip a character in the encoded body.
  const tamperedBody = (token[0] === "A" ? "B" : "A") + token.slice(1, dot + 1) + token.slice(dot + 1);
  expect(tamperedBody).not.toEqual(token);
  const session = await verifySession(tamperedBody);
  expect(session).toEqual(null);
});

test("verifySession: rejects a tampered signature", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);
  const dot = token.indexOf(".");
  const body = token.slice(0, dot);
  // Flip a whole signature byte, not just the last base64url character: the trailing character of a
  // 43-character value only contributes its top bits, so a different character can decode back to
  // the identical signature — the assertion would then pass or fail by luck.
  const sig = base64UrlDecode(token.slice(dot + 1));
  sig[0] ^= 0xff;
  const tampered = `${body}.${base64UrlEncode(sig)}`;
  expect(tampered).not.toEqual(token);
  const session = await verifySession(tampered);
  expect(session).toEqual(null);
});

test("verifySession: rejects a token signed with a different secret", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);

  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: "different-secret" });
  const session = await verifySession(token);
  expect(session).toEqual(null);
});

test("verifySession: rejects a malformed token", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  expect(await verifySession("")).toEqual(null);
  expect(await verifySession("not-a-token")).toEqual(null);
  expect(await verifySession("only-one-dot.bad")).toEqual(null);
  expect(await verifySession("!!!.@@@")).toEqual(null);
});

test("verifySession: rejects an expired token", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const issuedAt = Date.now() - (SESSION_MAX_AGE_SECONDS * 1000 + 1000);
  const body = `${USERNAME}.${issuedAt}`;
  const bodyEncoded = base64UrlEncode(new TextEncoder().encode(body));
  const sig = await hmacSha256Bytes(SECRET, bodyEncoded);
  const sigEncoded = base64UrlEncode(sig);
  const expired = `${bodyEncoded}.${sigEncoded}`;
  const session = await verifySession(expired);
  expect(session).toEqual(null);
});

test("verifySession: returns null when auth is disabled (even for valid tokens)", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);

  setEnv({});
  const session = await verifySession(token);
  expect(session).toEqual(null);
});

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacSha256Bytes(key: string, data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return new Uint8Array(sig);
}
