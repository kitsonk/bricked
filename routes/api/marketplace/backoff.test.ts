import { assertEquals } from "jsr:@std/assert@1.0.19";
import { computeBackoffDelay, isBricklinkAjaxCoolingDown, noteBricklinkAjaxThrottle } from "./index.ts";
import { isMarketplaceCacheFresh } from "@/utils/kv.ts";

// ---------------------------------------------------------------------------
// computeBackoffDelay
// ---------------------------------------------------------------------------

Deno.test("computeBackoffDelay: falls back to exponential base when retry-after is null", () => {
  assertEquals(computeBackoffDelay(0, null, 0), 2000);
  assertEquals(computeBackoffDelay(1, null, 0), 4000);
  assertEquals(computeBackoffDelay(2, null, 0), 8000);
});

Deno.test("computeBackoffDelay: ignores NaN and negative retry-after", () => {
  assertEquals(computeBackoffDelay(0, NaN, 0), 2000);
  assertEquals(computeBackoffDelay(0, -5, 0), 2000);
});

Deno.test("computeBackoffDelay: honors a retry-after above the exponential base", () => {
  assertEquals(computeBackoffDelay(0, 10, 0), 10000);
  assertEquals(computeBackoffDelay(3, 20, 0), 20000);
});

Deno.test("computeBackoffDelay: caps at 30000 plus jitter", () => {
  assertEquals(computeBackoffDelay(5, null, 500), 30500);
  assertEquals(computeBackoffDelay(0, 120, 0), 30000);
});

Deno.test("computeBackoffDelay: adds the injected jitter", () => {
  assertEquals(computeBackoffDelay(0, null, 250), 2250);
});

// ---------------------------------------------------------------------------
// isMarketplaceCacheFresh
// ---------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const NOW = 1_800_000_000_000;

Deno.test("isMarketplaceCacheFresh: never fresh for null savedAt (legacy payload)", () => {
  assertEquals(isMarketplaceCacheFresh(null, NOW), false);
});

Deno.test("isMarketplaceCacheFresh: fresh inside the 15-minute window", () => {
  const savedAt = new Date(NOW - 5 * MINUTE_MS).toISOString();
  assertEquals(isMarketplaceCacheFresh(savedAt, NOW), true);
});

Deno.test("isMarketplaceCacheFresh: boundary at exactly 15 minutes", () => {
  assertEquals(isMarketplaceCacheFresh(new Date(NOW - 15 * MINUTE_MS).toISOString(), NOW), false);
  assertEquals(isMarketplaceCacheFresh(new Date(NOW - 15 * MINUTE_MS + 1).toISOString(), NOW), true);
});

Deno.test("isMarketplaceCacheFresh: stale beyond the 15-minute window", () => {
  const savedAt = new Date(NOW - 16 * MINUTE_MS).toISOString();
  assertEquals(isMarketplaceCacheFresh(savedAt, NOW), false);
});

// ---------------------------------------------------------------------------
// BrickLink ajax cooldown
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 60_000;

Deno.test("cooldown: active immediately after noteBricklinkAjaxThrottle", () => {
  noteBricklinkAjaxThrottle(1000);
  assertEquals(isBricklinkAjaxCoolingDown(1000), true);
});

Deno.test("cooldown: still active just before the window ends", () => {
  assertEquals(isBricklinkAjaxCoolingDown(1000 + COOLDOWN_MS - 1), true);
});

Deno.test("cooldown: expired once the window has passed", () => {
  assertEquals(isBricklinkAjaxCoolingDown(1000 + COOLDOWN_MS), false);
});
