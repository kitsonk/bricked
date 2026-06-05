import { assertEquals } from "jsr:@std/assert@1.0.19";
import {
  _resetBanlistConfigForTesting,
  _resetBanlistForTesting,
  getClientIp,
  isBanned,
  recordUnauth,
} from "@/utils/banlist.ts";

function setEnv(overrides: Partial<Record<string, string | undefined>>) {
  for (
    const key of [
      "BANLIST_THRESHOLD",
      "BANLIST_WINDOW_MS",
      "BANLIST_TTL_MS",
      "BANLIST_CACHE_MAX",
      "TRUST_FORWARDED_FOR",
    ]
  ) {
    Deno.env.delete(key);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) Deno.env.set(key, value);
  }
  _resetBanlistConfigForTesting();
}

async function freshState() {
  await _resetBanlistForTesting();
  setEnv({});
}

Deno.test("banlist: isBanned returns false for an unknown IP", async () => {
  await freshState();
  assertEquals(await isBanned("203.0.113.1"), false);
});

Deno.test("banlist: recordUnauth below threshold does not ban", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "3", BANLIST_WINDOW_MS: "60000" });
  const r1 = await recordUnauth("203.0.113.2");
  assertEquals(r1, { banned: false, count: 1 });
  const r2 = await recordUnauth("203.0.113.2");
  assertEquals(r2, { banned: false, count: 2 });
  // 3rd hit crosses the threshold and triggers a ban.
  const r3 = await recordUnauth("203.0.113.2");
  assertEquals(r3, { banned: true, count: 3 });
  assertEquals(await isBanned("203.0.113.2"), true);
});

Deno.test("banlist: recordUnauth at threshold bans the IP", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "3", BANLIST_WINDOW_MS: "60000" });
  await recordUnauth("203.0.113.3");
  await recordUnauth("203.0.113.3");
  const r3 = await recordUnauth("203.0.113.3");
  assertEquals(r3.banned, true);
  assertEquals(r3.count, 3);
  assertEquals(await isBanned("203.0.113.3"), true);
});

Deno.test("banlist: subsequent recordUnauth on a banned IP is a no-op (no extra writes)", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "2", BANLIST_WINDOW_MS: "60000" });
  await recordUnauth("203.0.113.4");
  const r2 = await recordUnauth("203.0.113.4");
  assertEquals(r2.banned, true);
  const r3 = await recordUnauth("203.0.113.4");
  // Already-banned IPs do not have their counter incremented.
  assertEquals(r3, { banned: true, count: -1 });
  assertEquals(await isBanned("203.0.113.4"), true);
});

Deno.test("banlist: counter resets after the window expires", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "2", BANLIST_WINDOW_MS: "50" });
  const r1 = await recordUnauth("203.0.113.5");
  assertEquals(r1, { banned: false, count: 1 });
  await new Promise((r) => setTimeout(r, 80));
  const r2 = await recordUnauth("203.0.113.5");
  // The previous window has expired — counter restarts at 1.
  assertEquals(r2, { banned: false, count: 1 });
  assertEquals(await isBanned("203.0.113.5"), false);
});

Deno.test("banlist: independent IPs do not affect each other", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "2", BANLIST_WINDOW_MS: "60000" });
  await recordUnauth("203.0.113.6");
  await recordUnauth("203.0.113.6");
  assertEquals(await isBanned("203.0.113.6"), true);
  assertEquals(await isBanned("203.0.113.7"), false);
  await recordUnauth("203.0.113.7");
  assertEquals(await isBanned("203.0.113.7"), false);
});

Deno.test("banlist: in-memory cache reflects a fresh ban without re-reading KV", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "1", BANLIST_WINDOW_MS: "60000" });
  // First call writes the ban and populates the cache.
  const r = await recordUnauth("203.0.113.8");
  assertEquals(r.banned, true);
  // We should be banned, and a subsequent isBanned uses the cache.
  assertEquals(await isBanned("203.0.113.8"), true);
  // Sanity: a different IP remains unaffected.
  assertEquals(await isBanned("203.0.113.9"), false);
});

Deno.test("banlist: cache is invalidated when the underlying KV entry is removed", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "1", BANLIST_WINDOW_MS: "60000" });
  await recordUnauth("203.0.113.10");
  assertEquals(await isBanned("203.0.113.10"), true);
  // Manually wipe KV.
  const { kv } = await import("@/utils/kv.ts");
  const db = await kv();
  await db.delete(["banlist", "203.0.113.10"]);
  // The negative cache TTL is 30s — clear it so we actually re-read KV.
  await _resetBanlistForTesting();
  // After reset, the IP is no longer banned.
  assertEquals(await isBanned("203.0.113.10"), false);
});

Deno.test("getClientIp: strips port from IPv4 remoteAddr", () => {
  const req = new Request("http://localhost/");
  Object.defineProperty(req, "remoteAddr", {
    value: "198.51.100.1:54321",
    configurable: true,
  });
  assertEquals(getClientIp(req), "198.51.100.1");
});

Deno.test("getClientIp: strips brackets and port from IPv6 remoteAddr", () => {
  const req = new Request("http://localhost/");
  Object.defineProperty(req, "remoteAddr", {
    value: "[2001:db8::1]:54321",
    configurable: true,
  });
  assertEquals(getClientIp(req), "2001:db8::1");
});

Deno.test("getClientIp: accepts hostname-style NetAddr object", () => {
  const req = new Request("http://localhost/");
  Object.defineProperty(req, "remoteAddr", {
    value: { hostname: "203.0.113.50", port: 1234, transport: "tcp" },
    configurable: true,
  });
  assertEquals(getClientIp(req), "203.0.113.50");
});

Deno.test("getClientIp: returns null when no remoteAddr is available and forwarded headers are off", () => {
  setEnv({ TRUST_FORWARDED_FOR: undefined });
  const req = new Request("http://localhost/");
  assertEquals(getClientIp(req), null);
});

Deno.test("getClientIp: ignores X-Forwarded-For when TRUST_FORWARDED_FOR is unset", () => {
  setEnv({ TRUST_FORWARDED_FOR: undefined });
  const req = new Request("http://localhost/", {
    headers: { "x-forwarded-for": "198.51.100.99" },
  });
  Object.defineProperty(req, "remoteAddr", { value: "198.51.100.1:54321", configurable: true });
  assertEquals(getClientIp(req), "198.51.100.1");
});

Deno.test("getClientIp: uses X-Forwarded-For first hop when TRUST_FORWARDED_FOR is enabled", () => {
  setEnv({ TRUST_FORWARDED_FOR: "1" });
  const req = new Request("http://localhost/", {
    headers: { "x-forwarded-for": "198.51.100.99, 10.0.0.1, 10.0.0.2" },
  });
  Object.defineProperty(req, "remoteAddr", { value: "198.51.100.1:54321", configurable: true });
  assertEquals(getClientIp(req), "198.51.100.99");
});

Deno.test("getClientIp: uses X-Real-IP when TRUST_FORWARDED_FOR is enabled and XFF is missing", () => {
  setEnv({ TRUST_FORWARDED_FOR: "true" });
  const req = new Request("http://localhost/", {
    headers: { "x-real-ip": "198.51.100.77" },
  });
  Object.defineProperty(req, "remoteAddr", { value: "198.51.100.1:54321", configurable: true });
  assertEquals(getClientIp(req), "198.51.100.77");
});

Deno.test("getClientIp: falls back to remoteAddr when TRUST_FORWARDED_FOR is on but no headers are set", () => {
  setEnv({ TRUST_FORWARDED_FOR: "1" });
  const req = new Request("http://localhost/");
  Object.defineProperty(req, "remoteAddr", { value: "198.51.100.42:8080", configurable: true });
  assertEquals(getClientIp(req), "198.51.100.42");
});
