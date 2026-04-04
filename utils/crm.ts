import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, saveCrmMeta, saveCustomer } from "@/utils/kv.ts";
import type { Customer } from "@/utils/types.ts";
import { FILED_STATUSES } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "crm"]);

/**
 * Fetches all inbound orders from BrickLink, aggregates them by buyer_name
 * (excluding cancelled orders), and persists the results to Deno KV.
 */
export async function buildCrm(): Promise<void> {
  const creds = getCredentials();
  if (!creds) throw new Error("No BrickLink credentials configured");

  logger.info`CRM refresh started`;
  const client = new BricklinkClient(creds);

  // Fetch unfiled (active) and filed (historical) orders in parallel.
  const [unfiledOrders, filedOrders] = await Promise.all([
    client.getOrders("in", false),
    client.getOrders("in", true, FILED_STATUSES),
  ]);

  const allOrders = [...unfiledOrders, ...filedOrders];
  logger.debug`CRM: ${allOrders.length} total orders fetched`;

  // Aggregate by buyer_name, excluding cancelled orders.
  const customerMap = new Map<string, {
    orderCount: number;
    firstOrderDate: string;
    lastOrderDate: string;
    totalsByCurrency: Record<string, number>;
  }>();

  for (const order of allOrders) {
    if (order.status === "CANCELLED") continue;

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

  logger.debug`CRM: ${customerMap.size} unique customer(s) computed`;

  const now = new Date().toISOString();
  for (const [buyerName, data] of customerMap) {
    const customer: Customer = { buyerName, ...data, updatedAt: now };
    await saveCustomer(customer);
  }

  await saveCrmMeta({ lastRefreshedAt: now });
  logger.info`CRM refresh complete: ${customerMap.size} customer(s) saved`;
}
