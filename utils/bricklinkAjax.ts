import { bricklinkCatalogUrl } from "@/utils/format.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "bricklinkAjax"]);

export function bricklinkAjaxHeaders(
  itemType: string,
  itemNo: string,
  site: "same-origin" | "same-site" = "same-origin",
) {
  return {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-AU,en;q=0.9",
      priority: "u=1, i",
      referer: bricklinkCatalogUrl(itemType, itemNo),
      "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": site,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    },
  };
}

export function computeBackoffDelay(
  attempt: number,
  retryAfterSec: number | null,
  jitterMs = Math.random() * 1000,
): number {
  const retryMs = retryAfterSec !== null && Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : 0;
  return Math.min(Math.max(retryMs, 2000 * 2 ** attempt), 30000) + jitterMs;
}

export const BRICKLINK_AJAX_COOLDOWN_MS = 60_000;
let bricklinkAjaxCoolUntilMs = 0;

/** True while the bricklink.com/ajax host is in a cooldown window after a recent 429/403. */
export function isBricklinkAjaxCoolingDown(nowMs = Date.now()): boolean {
  return nowMs < bricklinkAjaxCoolUntilMs;
}

/** Put the bricklink.com/ajax host into a cooldown window after observing a 429/403. */
export function noteBricklinkAjaxThrottle(nowMs = Date.now()): void {
  bricklinkAjaxCoolUntilMs = nowMs + BRICKLINK_AJAX_COOLDOWN_MS;
}

export async function fetchWithBackoff(url: URL, init: RequestInit, maxAttempts = 3): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(url, init);
    } catch (err) {
      if (attempt + 1 >= maxAttempts) throw err;
      const delayMs = computeBackoffDelay(attempt, null);
      logger.warn`Fetch to ${url.pathname} failed (attempt ${attempt + 1}), retrying: ${String(err)}`;
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, delayMs);
      await promise;
      continue;
    }
    if (resp.status === 403) {
      noteBricklinkAjaxThrottle();
      logger.warn`Got 403 from ${url.pathname}; not retrying (browser-check block on website endpoints)`;
      return resp;
    }
    if (resp.status !== 429) return resp;
    noteBricklinkAjaxThrottle();
    if (attempt + 1 >= maxAttempts) {
      logger.warn`Got 429 from ${url.pathname} on final attempt; returning 429 to caller`;
      return resp;
    }
    const retryAfterRaw = parseInt(resp.headers.get("retry-after") ?? "", 10);
    const retryAfterSec = Number.isNaN(retryAfterRaw) || retryAfterRaw < 0 ? null : retryAfterRaw;
    const delayMs = computeBackoffDelay(attempt, retryAfterSec);
    logger.warn`Got 429 from ${url.pathname} on attempt ${attempt + 1}, retrying after ${Math.round(delayMs)}ms`;
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, delayMs);
    await promise;
  }
}

const inflight = new Map<string, Promise<unknown>>();

/** Deduplicate concurrent upstream fetches for the same key (double-clicks, colour/page races). */
export async function coalesced<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn();
  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}
