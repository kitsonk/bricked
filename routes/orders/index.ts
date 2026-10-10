import type { APIContext } from "astro";
import { BricklinkClient } from "@/utils/bricklink.ts";
import {
  getCredentials,
  getCustomer,
  getOrderMessageCountCache,
  listDriveThruSentOrderIds,
  saveOrderMessageCountCache,
} from "@/utils/kv.ts";
import type { BLOrderSummary } from "@/utils/types.ts";
import { FILED_STATUSES } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";
import type { PageResult } from "@/routes/pageResult.ts";

const logger = getLogger(["bricked", "routes", "orders"]);

export type OrdersData = {
  orders: BLOrderSummary[];
  sentOrderIds: number[];
  messageCounts: Record<number, number>;
  buyerOrderCounts: Record<string, number>;
  filter: "unfiled" | "filed";
  dateSort: "asc" | "desc";
  error: string | null;
};

export async function loadOrders({ url }: APIContext): Promise<PageResult<OrdersData>> {
  const creds = getCredentials();
  if (!creds) {
    return { kind: "redirect", to: "/environment" };
  }
  const filter = url.searchParams.get("filter") === "filed" ? "filed" : "unfiled";
  const dateSort = url.searchParams.get("sort") === "desc" ? "desc" : "asc";
  try {
    const client = new BricklinkClient(creds);
    const [orders, sentOrderIds] = await Promise.all([
      client.getOrders("in", filter === "filed", filter === "filed" ? FILED_STATUSES : undefined),
      listDriveThruSentOrderIds(),
    ]);
    logger.debug`Orders page: ${orders.length} order(s)`;
    let messageCounts: Record<number, number> = {};
    if (filter === "unfiled") {
      const counts = await Promise.all(
        orders.map(async (o) => {
          const cached = await getOrderMessageCountCache(o.order_id);
          if (cached !== null) return [o.order_id, cached] as const;
          try {
            const msgs = await client.getOrderMessages(o.order_id);
            const count = msgs.length;
            await saveOrderMessageCountCache(o.order_id, count);
            return [o.order_id, count] as const;
          } catch {
            return [o.order_id, 0] as const;
          }
        }),
      );
      messageCounts = Object.fromEntries(counts);
    }
    const uniqueBuyers = [...new Set(orders.map((o) => o.buyer_name))];
    const buyerCustomers = await Promise.all(uniqueBuyers.map((b) => getCustomer(b)));
    const buyerOrderCounts = Object.fromEntries(uniqueBuyers.map((b, i) => [b, buyerCustomers[i]?.orderCount ?? 0]));
    return {
      kind: "data",
      data: { orders, sentOrderIds, messageCounts, buyerOrderCounts, filter, dateSort, error: null },
    };
  } catch (err) {
    logger.error`Failed to load orders: ${err}`;
    return {
      kind: "data",
      data: {
        orders: [],
        sentOrderIds: [],
        messageCounts: {},
        buyerOrderCounts: {},
        filter,
        dateSort,
        error: String(err),
      },
    };
  }
}
