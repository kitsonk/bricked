import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials } from "@/utils/kv.ts";
import type { BLOrder, BLOrderItem } from "@/utils/types.ts";
import { decodeHtml } from "@/utils/html.ts";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "badge-warning",
  UPDATED: "badge-info",
  PROCESSING: "badge-primary",
  READY: "badge-success",
  PAID: "badge-success",
  PACKED: "badge-neutral",
  SHIPPED: "badge-neutral",
};

export const handler = define.handlers<{ order: BLOrder | null; items: BLOrderItem[]; error: string | null }>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/settings");
    }
    const orderId = Number(ctx.params.id);
    if (isNaN(orderId)) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const client = new BricklinkClient(creds);
      const [order, items] = await Promise.all([
        client.get<BLOrder>(`/orders/${orderId}`),
        client.getOrderItems(orderId),
      ]);
      return page({ order, items, error: null });
    } catch (err) {
      return page({ order: null, items: [], error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function OrderDetail({ data }) {
  const { order, items, error } = data;
  return (
    <AppFrame>
      <div class="p-6">
        <div class="flex items-center gap-4 mb-6">
          <a href="/orders" class="btn btn-ghost btn-sm">
            <span class="iconify lucide--arrow-left size-4"></span>
            Orders
          </a>
          {order && (
            <>
              <h1 class="text-2xl font-bold">Order #{order.order_id}</h1>
              <span class={`badge ${STATUS_COLORS[order.status] ?? "badge-ghost"}`}>
                {order.status}
              </span>
            </>
          )}
        </div>

        {error && (
          <div role="alert" class="alert alert-error mb-6">
            <span class="iconify lucide--alert-circle size-5"></span>
            <div>
              <div class="font-medium">Failed to load order</div>
              <div class="text-sm">{error}</div>
            </div>
          </div>
        )}

        {order && (
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div class="card bg-base-200">
              <div class="card-body p-4">
                <h2 class="card-title text-sm text-base-content/60 font-normal uppercase tracking-wide">
                  Buyer
                </h2>
                <p class="font-medium">{order.buyer_name}</p>
                <p class="text-sm text-base-content/60">{order.buyer_email}</p>
              </div>
            </div>
            <div class="card bg-base-200">
              <div class="card-body p-4">
                <h2 class="card-title text-sm text-base-content/60 font-normal uppercase tracking-wide">
                  Order Date
                </h2>
                <p class="font-medium">{new Date(order.date_ordered).toLocaleDateString()}</p>
                <p class="text-sm text-base-content/60">
                  Payment: {order.payment.status}
                </p>
              </div>
            </div>
            <div class="card bg-base-200">
              <div class="card-body p-4">
                <h2 class="card-title text-sm text-base-content/60 font-normal uppercase tracking-wide">
                  Total
                </h2>
                <p class="font-medium text-lg">
                  {order.disp_cost.currency_code} {order.disp_cost.grand_total}
                </p>
                <p class="text-sm text-base-content/60">
                  {order.total_count} items in {order.unique_count} lots
                </p>
              </div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold">Order Items</h2>
              <a
                href={`/pick-list?orders=${order?.order_id}`}
                class="btn btn-primary btn-sm"
              >
                <span class="iconify lucide--package size-4"></span>
                Pick List for This Order
              </a>
            </div>
            <div class="overflow-x-auto">
              <table class="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Color</th>
                    <th>Cond.</th>
                    <th class="text-right">Qty</th>
                    <th>Location</th>
                    <th class="text-right">Unit Price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: BLOrderItem) => (
                    <tr key={item.order_item_no}>
                      <td>
                        <div class="font-medium">{decodeHtml(item.item.name)}</div>
                        <div class="text-xs text-base-content/50 font-mono">{item.item.no}</div>
                      </td>
                      <td class="text-sm">{item.color_name}</td>
                      <td>
                        <span
                          class={`badge badge-xs ${item.new_or_used === "N" ? "badge-success" : "badge-warning"}`}
                        >
                          {item.new_or_used === "N" ? "New" : "Used"}
                        </span>
                      </td>
                      <td class="text-right font-bold">{item.quantity}</td>
                      <td>
                        {item.remarks
                          ? <span class="font-mono text-sm text-primary">{item.remarks}</span>
                          : <span class="text-base-content/30 text-xs">—</span>}
                      </td>
                      <td class="text-right text-sm font-mono">{item.disp_unit_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppFrame>
  );
});
