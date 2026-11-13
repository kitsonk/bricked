import { expect, test } from "vitest";
import { computeBackoffDelay, isBricklinkAjaxCoolingDown, noteBricklinkAjaxThrottle } from "@/utils/bricklinkAjax.ts";
import { isMarketplaceCacheFresh } from "@/utils/kv.ts";

// ---------------------------------------------------------------------------
// computeBackoffDelay
// ---------------------------------------------------------------------------

test("computeBackoffDelay: falls back to exponential base when retry-after is null", () => {
  expect(computeBackoffDelay(0, null, 0)).toEqual(2000);
  expect(computeBackoffDelay(1, null, 0)).toEqual(4000);
  expect(computeBackoffDelay(2, null, 0)).toEqual(8000);
});

test("computeBackoffDelay: ignores NaN and negative retry-after", () => {
  expect(computeBackoffDelay(0, NaN, 0)).toEqual(2000);
  expect(computeBackoffDelay(0, -5, 0)).toEqual(2000);
});

test("computeBackoffDelay: honors a retry-after above the exponential base", () => {
  expect(computeBackoffDelay(0, 10, 0)).toEqual(10000);
  expect(computeBackoffDelay(3, 20, 0)).toEqual(20000);
});

test("computeBackoffDelay: caps at 30000 plus jitter", () => {
  expect(computeBackoffDelay(5, null, 500)).toEqual(30500);
  expect(computeBackoffDelay(0, 120, 0)).toEqual(30000);
});

test("computeBackoffDelay: adds the injected jitter", () => {
  expect(computeBackoffDelay(0, null, 250)).toEqual(2250);
});

// ---------------------------------------------------------------------------
// isMarketplaceCacheFresh
// ---------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const NOW = 1_800_000_000_000;

test("isMarketplaceCacheFresh: never fresh for null savedAt (legacy payload)", () => {
  expect(isMarketplaceCacheFresh(null, NOW)).toEqual(false);
});

test("isMarketplaceCacheFresh: fresh inside the 15-minute window", () => {
  const savedAt = new Date(NOW - 5 * MINUTE_MS).toISOString();
  expect(isMarketplaceCacheFresh(savedAt, NOW)).toEqual(true);
});

test("isMarketplaceCacheFresh: boundary at exactly 15 minutes", () => {
  expect(isMarketplaceCacheFresh(new Date(NOW - 15 * MINUTE_MS).toISOString(), NOW)).toEqual(false);
  expect(isMarketplaceCacheFresh(new Date(NOW - 15 * MINUTE_MS + 1).toISOString(), NOW)).toEqual(true);
});

test("isMarketplaceCacheFresh: stale beyond the 15-minute window", () => {
  const savedAt = new Date(NOW - 16 * MINUTE_MS).toISOString();
  expect(isMarketplaceCacheFresh(savedAt, NOW)).toEqual(false);
});

// ---------------------------------------------------------------------------
// BrickLink ajax cooldown
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 60_000;

test("cooldown: active immediately after noteBricklinkAjaxThrottle", () => {
  noteBricklinkAjaxThrottle(1000);
  expect(isBricklinkAjaxCoolingDown(1000)).toEqual(true);
});

test("cooldown: still active just before the window ends", () => {
  expect(isBricklinkAjaxCoolingDown(1000 + COOLDOWN_MS - 1)).toEqual(true);
});

test("cooldown: expired once the window has passed", () => {
  expect(isBricklinkAjaxCoolingDown(1000 + COOLDOWN_MS)).toEqual(false);
});
