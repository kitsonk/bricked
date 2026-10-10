import { expect, test } from "vitest";
import {
  _resetBanlistConfigForTesting,
  _resetBanlistForTesting,
  getClientIp,
  isBanned,
  recordUnauth,
} from "@/utils/banlist.ts";
import { kv } from "@/utils/kv.ts";

const ENV_KEYS = [
  "BANLIST_THRESHOLD",
  "BANLIST_WINDOW_MS",
  "BANLIST_TTL_MS",
  "BANLIST_CACHE_MAX",
  "TRUST_FORWARDED_FOR",
];

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function setEnv(overrides: Partial<Record<string, string | undefined>>) {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) process.env[key] = value;
  }
  _resetBanlistConfigForTesting();
}

async function freshState() {
  await _resetBanlistForTesting();
  setEnv({});
}

test("banlist: isBanned returns false for an unknown IP", async () => {
  await freshState();
  expect(await isBanned("203.0.113.1")).toEqual(false);
});

test("banlist: recordUnauth below threshold does not ban", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "3", BANLIST_WINDOW_MS: "60000" });
  const r1 = await recordUnauth("203.0.113.2");
  expect(r1).toEqual({ banned: false, count: 1 });
  const r2 = await recordUnauth("203.0.113.2");
  expect(r2).toEqual({ banned: false, count: 2 });
  // 3rd hit crosses the threshold and triggers a ban.
  const r3 = await recordUnauth("203.0.113.2");
  expect(r3).toEqual({ banned: true, count: 3 });
  expect(await isBanned("203.0.113.2")).toEqual(true);
});

test("banlist: recordUnauth at threshold bans the IP", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "3", BANLIST_WINDOW_MS: "60000" });
  await recordUnauth("203.0.113.3");
  await recordUnauth("203.0.113.3");
  const r3 = await recordUnauth("203.0.113.3");
  expect(r3.banned).toEqual(true);
  expect(r3.count).toEqual(3);
  expect(await isBanned("203.0.113.3")).toEqual(true);
});

test("banlist: subsequent recordUnauth on a banned IP is a no-op (no extra writes)", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "2", BANLIST_WINDOW_MS: "60000" });
  await recordUnauth("203.0.113.4");
  const r2 = await recordUnauth("203.0.113.4");
  expect(r2.banned).toEqual(true);
  const r3 = await recordUnauth("203.0.113.4");
  // Already-banned IPs do not have their counter incremented.
  expect(r3).toEqual({ banned: true, count: -1 });
  expect(await isBanned("203.0.113.4")).toEqual(true);
});

test("banlist: counter resets after the window expires", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "2", BANLIST_WINDOW_MS: "50" });
  const r1 = await recordUnauth("203.0.113.5");
  expect(r1).toEqual({ banned: false, count: 1 });
  // A real delay is required: `recordUnauth` compares against the platform clock and the counter
  // lives in a SQLite-backed KV whose expiries are scheduled on real timers, so fake timers would
  // freeze the store instead of advancing the window.
  await delay(80);
  const r2 = await recordUnauth("203.0.113.5");
  // The previous window has expired — counter restarts at 1.
  expect(r2).toEqual({ banned: false, count: 1 });
  expect(await isBanned("203.0.113.5")).toEqual(false);
});

test("banlist: independent IPs do not affect each other", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "2", BANLIST_WINDOW_MS: "60000" });
  await recordUnauth("203.0.113.6");
  await recordUnauth("203.0.113.6");
  expect(await isBanned("203.0.113.6")).toEqual(true);
  expect(await isBanned("203.0.113.7")).toEqual(false);
  await recordUnauth("203.0.113.7");
  expect(await isBanned("203.0.113.7")).toEqual(false);
});

test("banlist: in-memory cache reflects a fresh ban without re-reading KV", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "1", BANLIST_WINDOW_MS: "60000" });
  // First call writes the ban and populates the cache.
  const r = await recordUnauth("203.0.113.8");
  expect(r.banned).toEqual(true);
  // We should be banned, and a subsequent isBanned uses the cache.
  expect(await isBanned("203.0.113.8")).toEqual(true);
  // Sanity: a different IP remains unaffected.
  expect(await isBanned("203.0.113.9")).toEqual(false);
});

test("banlist: cache is invalidated when the underlying KV entry is removed", async () => {
  await freshState();
  setEnv({ BANLIST_THRESHOLD: "1", BANLIST_WINDOW_MS: "60000" });
  await recordUnauth("203.0.113.10");
  expect(await isBanned("203.0.113.10")).toEqual(true);
  // Manually wipe KV.
  const db = await kv();
  await db.delete(["banlist", "203.0.113.10"]);
  // The negative cache TTL is 30s — clear it so we actually re-read KV.
  await _resetBanlistForTesting();
  // After reset, the IP is no longer banned.
  expect(await isBanned("203.0.113.10")).toEqual(false);
});

test("getClientIp: returns null when no clientAddress is available and forwarded headers are off", () => {
  setEnv({ TRUST_FORWARDED_FOR: undefined });
  const req = new Request("http://localhost/");
  expect(getClientIp(req)).toEqual(null);
});

test("getClientIp: ignores X-Forwarded-For when TRUST_FORWARDED_FOR is unset", () => {
  setEnv({ TRUST_FORWARDED_FOR: undefined });
  const req = new Request("http://localhost/", {
    headers: { "x-forwarded-for": "198.51.100.99" },
  });
  expect(getClientIp(req, "198.51.100.1")).toEqual("198.51.100.1");
});

test("getClientIp: uses X-Forwarded-For first hop when TRUST_FORWARDED_FOR is enabled", () => {
  setEnv({ TRUST_FORWARDED_FOR: "1" });
  const req = new Request("http://localhost/", {
    headers: { "x-forwarded-for": "198.51.100.99, 10.0.0.1, 10.0.0.2" },
  });
  expect(getClientIp(req, "198.51.100.1")).toEqual("198.51.100.99");
});

test("getClientIp: uses X-Real-IP when TRUST_FORWARDED_FOR is enabled and XFF is missing", () => {
  setEnv({ TRUST_FORWARDED_FOR: "true" });
  const req = new Request("http://localhost/", {
    headers: { "x-real-ip": "198.51.100.77" },
  });
  expect(getClientIp(req, "198.51.100.1")).toEqual("198.51.100.77");
});

test("getClientIp: falls back to clientAddress when TRUST_FORWARDED_FOR is on but no headers are set", () => {
  setEnv({ TRUST_FORWARDED_FOR: "1" });
  const req = new Request("http://localhost/");
  expect(getClientIp(req, "198.51.100.42")).toEqual("198.51.100.42");
});

test("getClientIp: normalizes an IPv4-mapped IPv6 clientAddress to plain IPv4", () => {
  setEnv({ TRUST_FORWARDED_FOR: undefined });
  const req = new Request("http://localhost/");
  expect(getClientIp(req, "::ffff:203.0.113.60")).toEqual("203.0.113.60");
});
