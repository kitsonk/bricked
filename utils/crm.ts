import { BricklinkClient } from "@/utils/bricklink.ts";
import {
  getCredentials,
  listCachedOrders,
  saveBuyerIndex,
  saveCrmMeta,
  saveCustomer,
  saveOrderCache,
} from "@/utils/kv.ts";
import { FILED_STATUSES } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "crm"]);

/**
 * Two-phase CRM refresh:
 *
 * Phase 1 — sync the local order cache from BrickLink.
 *   Fetches all inbound orders and writes each one to KV, except for orders
 *   with status PURGED (BrickLink degrades the order data before removing it;
 *   we preserve our last known-good copy instead).
 *
 * Phase 2 — rebuild customer aggregates from the full local cache.
 *   Because the cache retains orders that BrickLink has since purged, the
 *   customer view reflects the complete order history, not just the 6-month
 *   window the API exposes.
 */
export async function buildCrm(): Promise<void> {
  const creds = getCredentials();
  if (!creds) throw new Error("No BrickLink credentials configured");

  logger.info`CRM refresh started`;
  const client = new BricklinkClient(creds);

  // ── Phase 1: fetch from BrickLink and update the order cache ─────────────

  const [unfiledOrders, filedOrders] = await Promise.all([
    client.getOrders("in", false),
    client.getOrders("in", true, FILED_STATUSES),
  ]);

  const apiOrders = [...unfiledOrders, ...filedOrders];
  logger.debug`CRM phase 1: ${apiOrders.length} order(s) fetched from API`;

  let cacheUpdates = 0;
  for (const order of apiOrders) {
    // PURGED orders have degraded data — keep the cached version intact.
    if (order.status !== "PURGED") {
      await saveOrderCache(order);
      cacheUpdates++;
    }
  }
  logger.debug`CRM phase 1: ${cacheUpdates} order(s) written to cache`;

  // ── Phase 2: aggregate customer records from the full local cache ─────────

  const cachedOrders = await listCachedOrders();
  logger.debug`CRM phase 2: ${cachedOrders.length} order(s) in local cache`;

  const COMPLETED_STATUSES = new Set(["SHIPPED", "RECEIVED", "COMPLETED", "PURGED"]);

  const customerMap = new Map<string, {
    orderCount: number;
    firstOrderDate: string;
    lastOrderDate: string;
    totalsByCurrency: Record<string, number>;
  }>();

  for (const order of cachedOrders) {
    if (!COMPLETED_STATUSES.has(order.status)) continue;

    const existing = customerMap.get(order.buyer_name);
    const currency = order.cost.currency_code;
    const total = parseFloat(order.cost.grand_total);

    if (!existing) {
      customerMap.set(order.buyer_name, {
        orderCount: 1,
        firstOrderDate: order.date_ordered,
        lastOrderDate: order.date_ordered,
        totalsByCurrency: { [currency]: total },
      });
    } else {
      existing.orderCount++;
      if (order.date_ordered < existing.firstOrderDate) {
        existing.firstOrderDate = order.date_ordered;
      }
      if (order.date_ordered > existing.lastOrderDate) {
        existing.lastOrderDate = order.date_ordered;
      }
      existing.totalsByCurrency[currency] = (existing.totalsByCurrency[currency] ?? 0) + total;
    }
  }

  logger.debug`CRM phase 2: ${customerMap.size} unique customer(s) computed`;

  const now = new Date().toISOString();
  for (const [buyerName, data] of customerMap) {
    await saveCustomer({ buyerName, ...data, updatedAt: now });
  }

  await saveBuyerIndex([...customerMap.keys()]);
  await saveCrmMeta({ lastRefreshedAt: now });
  logger.info`CRM refresh complete: ${customerMap.size} customer(s) saved`;
}
