import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, listShippingMethodEnrichments } from "@/utils/kv.ts";
import type { BLOrder } from "@/utils/types.ts";
import { FILED_STATUSES } from "@/utils/types.ts";
import OrdersTable from "@/islands/OrdersTable.tsx";
import OrdersFilterTabs from "@/islands/OrdersFilterTabs.tsx";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "routes", "orders"]);

export const handler = define.handlers<{
  orders: BLOrder[];
  trackingMethodIds: number[];
  filter: "unfiled" | "filed";
  dateSort: "asc" | "desc";
  error: string | null;
}>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/environment");
    }
    const filter = ctx.url.searchParams.get("filter") === "filed" ? "filed" : "unfiled";
    const dateSort = ctx.url.searchParams.get("sort") === "desc" ? "desc" : "asc";
    try {
      const client = new BricklinkClient(creds);
      const [orders, enrichments] = await Promise.all([
        client.getOrders("in", filter === "filed", filter === "filed" ? FILED_STATUSES : undefined),
        listShippingMethodEnrichments(),
      ]);
      const trackingMethodIds = [...enrichments.entries()]
        .filter(([, e]) => e.hasTracking)
        .map(([id]) => id);
      logger.debug`Orders page: ${orders.length} order(s), ${trackingMethodIds.length} tracking method(s)`;
      return page({ orders, trackingMethodIds, filter, dateSort, error: null });
    } catch (err) {
      logger.error`Failed to load orders: ${err}`;
      return page({ orders: [], trackingMethodIds: [], filter, dateSort, error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function Orders({ data }) {
  const { filter, dateSort } = data;
  const refreshHref = `/orders${filter === "filed" ? `?filter=filed&sort=${dateSort}` : ""}`;
  return (
    <AppFrame>
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
        <OrdersTable orders={data.orders} trackingMethodIds={data.trackingMethodIds} dateSort={dateSort} />
      </div>
    </AppFrame>
  );
});
