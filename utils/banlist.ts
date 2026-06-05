import { kv } from "@/utils/kv.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "banlist"]);

const DEFAULT_THRESHOLD = 20;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_MAX = 10_000;

function readNumberEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

let _threshold = -1;
let _windowMs = -1;
let _ttlMs = -1;
let _cacheMax = -1;
let _trustForwardedFor = false;

function threshold(): number {
  if (_threshold < 0) _threshold = readNumberEnv("BANLIST_THRESHOLD", DEFAULT_THRESHOLD);
  return _threshold;
}

function windowMs(): number {
  if (_windowMs < 0) _windowMs = readNumberEnv("BANLIST_WINDOW_MS", DEFAULT_WINDOW_MS);
  return _windowMs;
}

function ttlMs(): number {
  if (_ttlMs < 0) _ttlMs = readNumberEnv("BANLIST_TTL_MS", DEFAULT_TTL_MS);
  return _ttlMs;
}

function cacheMax(): number {
  if (_cacheMax < 0) _cacheMax = readNumberEnv("BANLIST_CACHE_MAX", DEFAULT_CACHE_MAX);
  return _cacheMax;
}

function trustForwardedFor(): boolean {
  if (_trustForwardedFor) return true;
  const v = Deno.env.get("TRUST_FORWARDED_FOR");
  _trustForwardedFor = v === "1" || v === "true";
  return _trustForwardedFor;
}

interface CacheEntry {
  /** True if banned, false if known not-banned. */
  banned: boolean;
  /** Wall-clock time (ms) at which the cache entry should be discarded. */
  expiresAt: number;
}

const cache: Map<string, CacheEntry> = new Map();
const cacheNegativeTtlMs = 30_000;

function cacheGet(ip: string): CacheEntry | null {
  const entry = cache.get(ip);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(ip);
    return null;
  }
  // Touch — refresh insertion order so the LRU eviction is usage-based.
  cache.delete(ip);
  cache.set(ip, entry);
  return entry;
}

function cacheSet(ip: string, banned: boolean, ttl: number): void {
  if (cache.size >= cacheMax() && !cache.has(ip)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(ip, { banned, expiresAt: Date.now() + ttl });
}

function banKey(ip: string): Deno.KvKey {
  return ["banlist", ip];
}

function counterKey(ip: string): Deno.KvKey {
  return ["banlist_counter", ip];
}

interface Counter {
  count: number;
  windowStart: number;
}

export function getClientIp(req: Request): string | null {
  if (trustForwardedFor()) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const xri = req.headers.get("x-real-ip")?.trim();
    if (xri) return xri;
  }
  const remote = (req as unknown as { remoteAddr?: { hostname?: string; transport?: string } | string }).remoteAddr;
  let addr: string | null = null;
  if (typeof remote === "string") {
    addr = remote;
  } else if (remote && typeof remote === "object" && "hostname" in remote && typeof remote.hostname === "string") {
    addr = remote.hostname;
  }
  if (!addr) return null;
  return stripPort(addr);
}

function stripPort(addr: string): string {
  if (addr.startsWith("[")) {
    const end = addr.indexOf("]");
    if (end >= 0) return addr.slice(1, end);
    return addr.slice(1);
  }
  const lastColon = addr.lastIndexOf(":");
  if (lastColon > 0 && addr.indexOf(":") === lastColon) {
    return addr.slice(0, lastColon);
  }
  return addr;
}

/** True if the given IP is currently banned. Cached in-memory. */
export async function isBanned(ip: string): Promise<boolean> {
  const cached = cacheGet(ip);
  if (cached) return cached.banned;
  const db = await kv();
  const result = await db.get<true>(banKey(ip));
  const banned = result.value === true;
  cacheSet(ip, banned, banned ? ttlMs() : cacheNegativeTtlMs);
  return banned;
}

export interface RecordResult {
  /** True if this call promoted the IP to banned. */
  banned: boolean;
  /** The current unauth count in the window. */
  count: number;
}

/**
 * Record an unauthenticated request from the given IP. Returns whether this
 * call pushed the IP over the threshold into a ban. Idempotent: a no-op if
 * the IP is already banned (no extra KV writes).
 */
export async function recordUnauth(ip: string): Promise<RecordResult> {
  if (await isBanned(ip)) {
    return { banned: true, count: -1 };
  }

  const db = await kv();
  const k = counterKey(ip);
  const now = Date.now();
  const win = windowMs();
  const current = await db.get<Counter>(k);
  const existing = current.value;

  let count: number;
  let windowStart: number;
  if (!existing || now - existing.windowStart >= win) {
    count = 1;
    windowStart = now;
  } else {
    count = existing.count + 1;
    windowStart = existing.windowStart;
  }

  await db.set(k, { count, windowStart }, { expireIn: win });

  if (count >= threshold()) {
    await db.set(banKey(ip), true, { expireIn: ttlMs() });
    cacheSet(ip, true, ttlMs());
    logger.warn("Banlist: banned {ip} after {count} unauth requests", { ip, count });
    return { banned: true, count };
  }

  logger.debug("Banlist: unauth {count}/{threshold} from {ip}", { count, threshold: threshold(), ip });
  return { banned: false, count };
}

/** Test-only: clear KV state and in-memory caches. */
export async function _resetBanlistForTesting(): Promise<void> {
  const db = await kv();
  for await (const entry of db.list({ prefix: ["banlist"] })) {
    await db.delete(entry.key);
  }
  for await (const entry of db.list({ prefix: ["banlist_counter"] })) {
    await db.delete(entry.key);
  }
  cache.clear();
}

/** Test-only: clear memoised env-derived config. */
export function _resetBanlistConfigForTesting(): void {
  _threshold = -1;
  _windowMs = -1;
  _ttlMs = -1;
  _cacheMax = -1;
  _trustForwardedFor = false;
}
