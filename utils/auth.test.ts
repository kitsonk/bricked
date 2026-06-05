import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1.0.19";
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
    Deno.env.delete(key);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) Deno.env.set(key, value);
  }
  _resetAuthConfigForTesting();
}

Deno.test("auth: AUTH_COOKIE is bricked_session", () => {
  assertEquals(AUTH_COOKIE, "bricked_session");
});

Deno.test("auth: SESSION_MAX_AGE_SECONDS is 30 days", () => {
  assertEquals(SESSION_MAX_AGE_SECONDS, 60 * 60 * 24 * 30);
});

Deno.test("getAuthConfig: returns null when any required env var is missing", () => {
  setEnv({});
  assertEquals(getAuthConfig(), null);
  assertEquals(isAuthEnabled(), false);

  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD });
  assertEquals(getAuthConfig(), null);

  setEnv({ APP_USERNAME: USERNAME, SESSION_SECRET: SECRET });
  assertEquals(getAuthConfig(), null);

  setEnv({ APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  assertEquals(getAuthConfig(), null);
});

Deno.test("getAuthConfig: returns the config when all env vars are set", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const config = getAuthConfig();
  assert(config);
  assertEquals(config.username, USERNAME);
  assertEquals(config.password, PASSWORD);
  assertEquals(config.sessionSecret, SECRET);
  assertEquals(isAuthEnabled(), true);
});

Deno.test("verifyCredentials: returns false when auth is disabled", () => {
  setEnv({});
  const ok = verifyCredentials(USERNAME, PASSWORD);
  assertEquals(ok, false);
});

Deno.test("verifyCredentials: accepts the correct username and password", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  assertEquals(verifyCredentials(USERNAME, PASSWORD), true);
});

Deno.test("verifyCredentials: rejects the wrong password", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  assertEquals(verifyCredentials(USERNAME, "wrong"), false);
});

Deno.test("verifyCredentials: rejects the wrong username", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  assertEquals(verifyCredentials("not-admin", PASSWORD), false);
});

Deno.test("verifyCredentials: rejects empty submissions", () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  assertEquals(verifyCredentials("", ""), false);
  assertEquals(verifyCredentials(USERNAME, ""), false);
  assertEquals(verifyCredentials("", PASSWORD), false);
});

Deno.test("signSession + verifySession: roundtrip succeeds", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);
  const session = await verifySession(token);
  assert(session);
  assertEquals(session.username, USERNAME);
  assert(session.issuedAt > 0);
  assert(session.issuedAt <= Date.now());
});

Deno.test("signSession: throws when auth is disabled", async () => {
  setEnv({});
  await assertRejects(() => signSession(USERNAME));
});

Deno.test("verifySession: rejects a tampered body", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);
  const dot = token.indexOf(".");
  // Flip a character in the encoded body.
  const tamperedBody = (token[0] === "A" ? "B" : "A") + token.slice(1, dot + 1) + token.slice(dot + 1);
  assertNotEquals(tamperedBody, token);
  const session = await verifySession(tamperedBody);
  assertEquals(session, null);
});

Deno.test("verifySession: rejects a tampered signature", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);
  const dot = token.indexOf(".");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const flipped = sig.slice(0, -1) + (sig.slice(-1) === "A" ? "B" : "A");
  const session = await verifySession(`${body}.${flipped}`);
  assertEquals(session, null);
});

Deno.test("verifySession: rejects a token signed with a different secret", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);

  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: "different-secret" });
  const session = await verifySession(token);
  assertEquals(session, null);
});

Deno.test("verifySession: rejects a malformed token", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  assertEquals(await verifySession(""), null);
  assertEquals(await verifySession("not-a-token"), null);
  assertEquals(await verifySession("only-one-dot.bad"), null);
  assertEquals(await verifySession("!!!.@@@"), null);
});

Deno.test("verifySession: rejects an expired token", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const issuedAt = Date.now() - (SESSION_MAX_AGE_SECONDS * 1000 + 1000);
  const body = `${USERNAME}.${issuedAt}`;
  const bodyEncoded = base64UrlEncode(new TextEncoder().encode(body));
  const sig = await hmacSha256Bytes(SECRET, bodyEncoded);
  const sigEncoded = base64UrlEncode(sig);
  const expired = `${bodyEncoded}.${sigEncoded}`;
  const session = await verifySession(expired);
  assertEquals(session, null);
});

Deno.test("verifySession: returns null when auth is disabled (even for valid tokens)", async () => {
  setEnv({ APP_USERNAME: USERNAME, APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  const token = await signSession(USERNAME);

  setEnv({});
  const session = await verifySession(token);
  assertEquals(session, null);
});

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function hmacSha256Bytes(key: string, data: string): Promise<Uint8Array> {
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

async function assertRejects(fn: () => Promise<unknown>): Promise<void> {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  assert(rejected, "expected the function to reject");
}
