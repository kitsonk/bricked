import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import {
  getCredentials,
  getOrderMessageCountCache,
  listDriveThruSentOrderIds,
  saveOrderMessageCountCache,
} from "@/utils/kv.ts";
import type { BLOrderSummary } from "@/utils/types.ts";
import { FILED_STATUSES } from "@/utils/types.ts";
import OrdersTable from "@/islands/OrdersTable.tsx";
import OrdersFilterTabs from "@/islands/OrdersFilterTabs.tsx";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "routes", "orders"]);

export type OrdersData = {
  orders: BLOrderSummary[];
  sentOrderIds: number[];
  messageCounts: Record<number, number>;
  filter: "unfiled" | "filed";
  dateSort: "asc" | "desc";
  error: string | null;
};

export const handler = define.handlers<OrdersData>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/environment");
    }
    const filter = ctx.url.searchParams.get("filter") === "filed" ? "filed" : "unfiled";
    const dateSort = ctx.url.searchParams.get("sort") === "desc" ? "desc" : "asc";
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
      return page({ orders, sentOrderIds, messageCounts, filter, dateSort, error: null });
    } catch (err) {
      logger.error`Failed to load orders: ${err}`;
      return page({ orders: [], sentOrderIds: [], messageCounts: {}, filter, dateSort, error: String(err) });
    }
  },
});

export function OrdersContent({ data }: { data: OrdersData }) {
  const { filter, dateSort } = data;
  const refreshHref = `/orders${filter === "filed" ? `?filter=filed&sort=${dateSort}` : ""}`;
  return (
    <>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">Orders</h1>
        <a href={refreshHref} class="btn btn-ghost btn-sm">
          <span class="iconify lucide--refresh-cw size-4"></span>
          Refresh
        </a>
      </div>

      <OrdersFilterTabs filter={filter} />
      <div class="border border-base-content/10 rounded-box p-4">
        {data.error && (
          <div role="alert" class="alert alert-error mb-6">
            <span class="iconify lucide--alert-circle size-5"></span>
            <div>
              <div class="font-medium">Failed to load orders</div>
              <div class="text-sm">{data.error}</div>
            </div>
          </div>
        )}
        <OrdersTable
          orders={data.orders}
          sentOrderIds={data.sentOrderIds}
          messageCounts={data.filter === "unfiled" ? data.messageCounts : undefined}
          dateSort={dateSort}
        />
      </div>
    </>
  );
}

export default define.page<typeof handler>(function Orders({ data }) {
  return (
    <AppFrame>
      <OrdersContent data={data} />
    </AppFrame>
  );
});
