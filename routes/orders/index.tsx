import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, listDriveThruSentOrderIds } from "@/utils/kv.ts";
import type { BLOrder } from "@/utils/types.ts";
import { ALL_STATUSES, UNFULFILLED_STATUSES } from "@/utils/types.ts";
import OrdersTable from "@/islands/OrdersTable.tsx";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "routes", "orders"]);

export const handler = define.handlers<{
  orders: BLOrder[];
  sentDriveThruIds: number[];
  filter: "unfulfilled" | "all";
  error: string | null;
}>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/settings");
    }
    const filter = ctx.url.searchParams.get("filter") === "all" ? "all" : "unfulfilled";
    try {
      const client = new BricklinkClient(creds);
      logger.debug`Fetching orders (filter=${filter}) and drive-thru sent IDs`;
      const [orders, sentDriveThruIds] = await Promise.all([
        client.getOrders("in", filter === "unfulfilled" ? UNFULFILLED_STATUSES : ALL_STATUSES),
        listDriveThruSentOrderIds().catch((err) => {
          logger.error`Failed to load drive-thru sent IDs from KV: ${err}`;
          return [];
        }),
      ]);
      logger.debug`Orders page: ${orders.length} order(s), ${sentDriveThruIds.length} drive-thru sent ID(s)`;
      return page({ orders, sentDriveThruIds, filter, error: null });
    } catch (err) {
      logger.error`Failed to load orders: ${err}`;
      return page({ orders: [], sentDriveThruIds: [], filter, error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function Orders({ data }) {
  const { filter } = data;
  return (
    <AppFrame>
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold">Orders</h1>
          <a href={`/orders${filter === "all" ? "?filter=all" : ""}`} class="btn btn-ghost btn-sm">
            <span class="iconify lucide--refresh-cw size-4"></span>
            Refresh
          </a>
        </div>

        <div role="tablist" class="tabs tabs-box mb-6 w-fit">
          <a
            role="tab"
            href="/orders"
            class={`tab ${filter === "unfulfilled" ? "tab-active" : ""}`}
          >
            Unfulfilled
          </a>
          <a
            role="tab"
            href="/orders?filter=all"
            class={`tab ${filter === "all" ? "tab-active" : ""}`}
          >
            All Orders
          </a>
        </div>

        {data.error && (
          <div role="alert" class="alert alert-error mb-6">
            <span class="iconify lucide--alert-circle size-5"></span>
            <div>
              <div class="font-medium">Failed to load orders</div>
              <div class="text-sm">{data.error}</div>
            </div>
          </div>
        )}

        <OrdersTable orders={data.orders} sentDriveThruIds={data.sentDriveThruIds} />
      </div>
    </AppFrame>
  );
});
