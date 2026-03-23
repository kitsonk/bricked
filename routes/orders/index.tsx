import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials } from "@/utils/kv.ts";
import type { BLOrder } from "@/utils/types.ts";
import { UNFULFILLED_STATUSES } from "@/utils/types.ts";
import OrdersTable from "@/islands/OrdersTable.tsx";

export const handler = define.handlers<{ orders: BLOrder[]; error: string | null }>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/settings");
    }
    try {
      const client = new BricklinkClient(creds);
      const orders = await client.getOrders("in", UNFULFILLED_STATUSES);
      return page({ orders, error: null });
    } catch (err) {
      return page({ orders: [], error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function Orders({ data }) {
  return (
    <AppFrame>
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold">Unfulfilled Orders</h1>
          <a href="/orders" class="btn btn-ghost btn-sm">
            <span class="iconify lucide--refresh-cw size-4"></span>
            Refresh
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

        <OrdersTable orders={data.orders} />
      </div>
    </AppFrame>
  );
});
