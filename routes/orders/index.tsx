import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, listDriveThruSentOrderIds } from "@/utils/kv.ts";
import type { BLOrder } from "@/utils/types.ts";
import { FILED_STATUSES } from "@/utils/types.ts";
import OrdersTable from "@/islands/OrdersTable.tsx";
import OrdersFilterTabs from "@/islands/OrdersFilterTabs.tsx";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "routes", "orders"]);

export const handler = define.handlers<{
  orders: BLOrder[];
  sentDriveThruIds: number[];
  filter: "unfiled" | "filed";
  error: string | null;
}>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/settings");
    }
    const filter = ctx.url.searchParams.get("filter") === "filed" ? "filed" : "unfiled";
    try {
      const client = new BricklinkClient(creds);
      logger.debug`Fetching orders (filter=${filter}) and drive-thru sent IDs`;
      const [orders, sentDriveThruIds] = await Promise.all([
        client.getOrders("in", filter === "filed", filter === "filed" ? FILED_STATUSES : undefined),
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
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">Orders</h1>
        <a href={`/orders${filter === "filed" ? "?filter=filed" : ""}`} class="btn btn-ghost btn-sm">
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
        <OrdersTable orders={data.orders} sentDriveThruIds={data.sentDriveThruIds} />
      </div>
    </AppFrame>
  );
});
