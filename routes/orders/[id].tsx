import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, getShippingMethodEnrichment } from "@/utils/kv.ts";
import type { BLOrder, BLOrderItem, BLOrderMessage } from "@/utils/types.ts";
import { OrderMessageBubble } from "@/components/OrderMessageBubble.tsx";
import { StatusBadge } from "@/components/StatusBadge.tsx";
import { formatAmount, humanTime } from "@/utils/format.ts";
import OrderShipButton from "@/islands/OrderShipButton.tsx";
import OrderItemsTable from "@/islands/OrderItemsTable.tsx";

export const handler = define.handlers<{
  order: BLOrder | null;
  items: BLOrderItem[];
  messages: BLOrderMessage[];
  hasTracking: boolean;
  error: string | null;
}>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/environment");
    }
    const orderId = Number(ctx.params.id);
    if (isNaN(orderId)) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const client = new BricklinkClient(creds);
      const [order, items, messages] = await Promise.all([
        client.get<BLOrder>(`/orders/${orderId}`),
        client.getOrderItems(orderId),
        client.getOrderMessages(orderId),
      ]);
      const enrichment = order.shipping?.method_id ? await getShippingMethodEnrichment(order.shipping.method_id) : null;
      return page({ order, items, messages, hasTracking: enrichment?.hasTracking ?? false, error: null });
    } catch (err) {
      return page({ order: null, items: [], messages: [], hasTracking: false, error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function OrderDetail({ data }) {
  const { order, items, messages, error } = data;
  return (
    <AppFrame>
      <div class="flex items-center gap-4 mb-6">
        <a href="/orders" class="btn btn-ghost btn-sm">
          <span class="iconify lucide--arrow-left size-4"></span>
          Orders
        </a>
        {order && (
          <>
            <h1 class="text-2xl font-bold">Order #{order.order_id}</h1>
            <StatusBadge status={order.status} size="md" />
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
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div class="card bg-base-200">
            <div class="card-body p-4">
              <h2 class="card-title text-sm text-base-content/60 font-normal uppercase tracking-wide">
                Buyer
              </h2>
              <p class="font-medium">
                {order.buyer_name}
                {(order.shipping.address.name.first || order.shipping.address.name.full) && (
                  <span class="text-base-content/50 font-normal ml-1">
                    ({order.shipping.address.name.first || order.shipping.address.name.full})
                  </span>
                )}
              </p>
              <p class="text-sm text-base-content/60">{order.buyer_email}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body p-4">
              <h2 class="card-title text-sm text-base-content/60 font-normal uppercase tracking-wide">
                Ordered
              </h2>
              <p class="font-medium">{humanTime(order.date_ordered)}</p>
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
                {order.disp_cost.currency_code} {formatAmount(order.disp_cost.grand_total)}
              </p>
              <p class="text-sm text-base-content/60">
                {order.total_count} items in {order.unique_count} lots
              </p>
            </div>
          </div>
          <div class="card bg-base-200 lg:col-span-3">
            <div class="card-body p-4">
              <div class="flex items-center justify-between">
                <h2 class="card-title text-sm text-base-content/60 font-normal uppercase tracking-wide">
                  Shipping
                </h2>
                {order.status === "PACKED" && <OrderShipButton order={order} hasTracking={data.hasTracking} />}
              </div>
              <div class="flex flex-wrap gap-x-8 gap-y-1">
                {order.shipping.method && (
                  <p class="font-medium">
                    {order.shipping.method}
                    <span class="text-xs text-base-content/40 font-mono ml-2">#{order.shipping.method_id}</span>
                  </p>
                )}
                {order.shipping.address.name.full && (
                  <p class="text-sm text-base-content/60">{order.shipping.address.name.full}</p>
                )}
                {(order.shipping.address.address1 || order.shipping.address.city) && (
                  <p class="text-sm text-base-content/60">
                    {[
                      order.shipping.address.address1,
                      order.shipping.address.address2,
                      order.shipping.address.city,
                      order.shipping.address.state,
                      order.shipping.address.postal_code,
                      order.shipping.address.country_code,
                    ].filter(Boolean).join(", ")}
                  </p>
                )}
                {order.shipping.date_shipped && (
                  <p class="text-sm text-base-content/60">
                    Shipped: {new Date(order.shipping.date_shipped).toLocaleDateString()}
                  </p>
                )}
                {order.shipping.tracking_no && (
                  <p class="text-sm">
                    Tracking: {order.shipping.tracking_link
                      ? (
                        <a
                          href={order.shipping.tracking_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="link font-mono"
                        >
                          {order.shipping.tracking_no}
                        </a>
                      )
                      : <span class="font-mono">{order.shipping.tracking_no}</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div class="tabs tabs-border">
          <input type="radio" name="order_tabs" class="tab" aria-label="Order Items" checked />
          <div class="tab-content border-base-300 bg-base-100">
            <OrderItemsTable
              orderId={order!.order_id}
              items={items}
              currencyCode={order!.disp_cost.currency_code}
            />
          </div>

          {messages.length > 0 && (
            <>
              <input type="radio" name="order_tabs" class="tab" aria-label="Messages" />
              <div class="tab-content border-base-300 bg-base-100 p-6">
                <div class="max-w-2xl mx-auto">
                  {[...messages]
                    .sort((a, b) => new Date(a.dateSent).getTime() - new Date(b.dateSent).getTime())
                    .map((msg, i) => (
                      <OrderMessageBubble
                        key={i}
                        msg={msg}
                        direction={msg.from === order?.buyer_name ? "start" : "end"}
                      />
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </AppFrame>
  );
});
