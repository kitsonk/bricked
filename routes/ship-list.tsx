import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials } from "@/utils/kv.ts";
import type { BLOrder } from "@/utils/types.ts";
import { StatusBadge } from "@/components/StatusBadge.tsx";
import { humanTime } from "@/utils/format.ts";

export const handler = define.handlers<{ orders: BLOrder[]; error: string | null }>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) return ctx.redirect("/environment");

    const orderParam = ctx.url.searchParams.get("orders") ?? "";
    const orderIds = orderParam
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    if (orderIds.length === 0) return ctx.redirect("/orders");

    try {
      const client = new BricklinkClient(creds);
      const orders = await Promise.all(orderIds.map((id) => client.get<BLOrder>(`/orders/${id}`)));
      return page({ orders, error: null });
    } catch (err) {
      return page({ orders: [], error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function ShipListPage({ data }) {
  const { orders, error } = data;
  return (
    <AppFrame>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">Prepare to Ship</h1>
        <a href="/orders" class="btn btn-ghost btn-sm">
          <span class="iconify lucide--arrow-left size-4"></span>
          Back to Orders
        </a>
      </div>

      {error && (
        <div role="alert" class="alert alert-error mb-6">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>
            <div class="font-medium">Failed to load orders</div>
            <div class="text-sm">{error}</div>
          </div>
        </div>
      )}

      {!error && orders.length === 0 && (
        <div class="text-center py-16 text-base-content/50">
          <span class="iconify lucide--truck size-12 block mx-auto mb-3"></span>
          <p class="font-medium">No orders selected</p>
          <a href="/orders" class="btn btn-ghost btn-sm mt-4">Back to Orders</a>
        </div>
      )}

      {orders.length > 0 && (
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Buyer</th>
                <th>Ordered</th>
                <th>Status</th>
                <th>Shipping Method</th>
                <th>Shipping Address</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const addr = order.shipping?.address;
                const addressLine = addr
                  ? [addr.address1, addr.address2, addr.city, addr.state, addr.postal_code, addr.country_code]
                    .filter(Boolean)
                    .join(", ")
                  : "—";
                return (
                  <tr key={order.order_id}>
                    <td>
                      <a class="link font-mono font-medium" href={`/orders/${order.order_id}`}>
                        #{order.order_id}
                      </a>
                    </td>
                    <td>
                      <div class="font-medium">{order.buyer_name}</div>
                      <div class="text-xs text-base-content/50">{order.buyer_email}</div>
                    </td>
                    <td class="text-sm">{humanTime(order.date_ordered)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td class="text-sm">{order.shipping?.method || "—"}</td>
                    <td class="text-sm">{addressLine}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppFrame>
  );
});
