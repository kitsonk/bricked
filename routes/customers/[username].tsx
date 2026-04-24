import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import {
  getCredentials,
  getOrderMessageCountCache,
  listCachedOrdersByBuyer,
  saveOrderMessageCountCache,
} from "@/utils/kv.ts";
import type { BLMemberRating, BLOrderSummary } from "@/utils/types.ts";
import { StatusBadge } from "@/components/StatusBadge.tsx";
import { formatAmount, humanTime } from "@/utils/format.ts";

export type CustomerDetailData = {
  username: string;
  rating: BLMemberRating | null;
  orders: BLOrderSummary[];
  messageCounts: Record<number, number>;
  ratingError: string | null;
};

export const handler = define.handlers<CustomerDetailData>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) return ctx.redirect("/environment");

    const username = decodeURIComponent(ctx.params.username);
    const client = new BricklinkClient(creds);

    const [ratingResult, orders] = await Promise.all([
      client.getMemberRating(username).then((r) => ({ ok: true as const, value: r })).catch((e) => ({
        ok: false as const,
        error: String(e),
      })),
      listCachedOrdersByBuyer(username),
    ]);

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
    const messageCounts = Object.fromEntries(counts);

    return page({
      username,
      rating: ratingResult.ok ? ratingResult.value : null,
      orders,
      messageCounts,
      ratingError: ratingResult.ok ? null : ratingResult.error,
    });
  },
});

export function CustomerDetailContent({ data }: { data: CustomerDetailData }) {
  const { username, rating, orders, messageCounts, ratingError } = data;
  const total = rating ? rating.rating.PRAISE + rating.rating.NEUTRAL + rating.rating.COMPLAINT : 0;

  return (
    <>
      <div class="flex items-center gap-4 mb-6">
        <a href="/customers" class="btn btn-ghost btn-sm">
          <span class="iconify lucide--arrow-left size-4"></span>
          Customers
        </a>
        <h1 class="text-2xl font-bold">{username}</h1>
      </div>

      {/* Member Rating */}
      <div class="border border-base-content/10 rounded-box p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4">Member Rating</h2>
        {ratingError
          ? (
            <div role="alert" class="alert alert-warning">
              <span class="iconify lucide--alert-triangle size-5"></span>
              <div>
                <div class="font-medium">Could not load rating</div>
                <div class="text-sm">{ratingError}</div>
              </div>
            </div>
          )
          : rating
          ? (
            <div class="flex gap-4">
              <div class="stat bg-success/10 rounded-box p-4 flex-1">
                <div class="stat-title text-xs">Praised</div>
                <div class="stat-value text-success text-2xl">{rating.rating.PRAISE}</div>
                {total > 0 && <div class="stat-desc">{Math.round((rating.rating.PRAISE / total) * 100)}%</div>}
              </div>
              <div class="stat bg-base-200 rounded-box p-4 flex-1">
                <div class="stat-title text-xs">Neutral</div>
                <div class="stat-value text-2xl">{rating.rating.NEUTRAL}</div>
                {total > 0 && <div class="stat-desc">{Math.round((rating.rating.NEUTRAL / total) * 100)}%</div>}
              </div>
              <div class="stat bg-error/10 rounded-box p-4 flex-1">
                <div class="stat-title text-xs">Complained</div>
                <div class="stat-value text-error text-2xl">{rating.rating.COMPLAINT}</div>
                {total > 0 && <div class="stat-desc">{Math.round((rating.rating.COMPLAINT / total) * 100)}%</div>}
              </div>
              <div class="stat bg-base-200 rounded-box p-4 flex-1">
                <div class="stat-title text-xs">Total</div>
                <div class="stat-value text-2xl">{total}</div>
              </div>
            </div>
          )
          : null}
      </div>

      {/* Order History */}
      <div class="border border-base-content/10 rounded-box p-6">
        <h2 class="text-lg font-semibold mb-4">
          Order History
          <span class="text-base font-normal text-base-content/50 ml-2">
            {orders.length} order{orders.length !== 1 ? "s" : ""}
          </span>
        </h2>
        {orders.length === 0
          ? (
            <div class="text-center py-8 text-base-content/50">
              <span class="iconify lucide--inbox size-10 block mx-auto mb-2"></span>
              <p>No cached orders for this buyer.</p>
            </div>
          )
          : (
            <div class="overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th></th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.order_id}>
                      <td>
                        <a class="link font-mono font-medium" href={`/orders/${order.order_id}`}>
                          #{order.order_id}
                        </a>
                      </td>
                      <td class="text-sm">
                        {(messageCounts[order.order_id] ?? 0) > 0 && (
                          <span class="flex items-center gap-1 text-primary">
                            <span class="iconify lucide--message-circle size-4"></span>
                            {messageCounts[order.order_id]}
                          </span>
                        )}
                      </td>
                      <td class="text-sm">
                        <span title={new Date(order.date_ordered).toLocaleDateString()}>
                          {humanTime(order.date_ordered)}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td class="text-sm">
                        {order.total_count > 0
                          ? (
                            <>
                              {order.total_count} <span class="text-base-content/50">({order.unique_count} lots)</span>
                            </>
                          )
                          : <span class="text-base-content/30">—</span>}
                      </td>
                      <td class="text-right font-medium tabular-nums">
                        {order.cost.currency_code
                          ? `${order.cost.currency_code} ${formatAmount(order.cost.grand_total)}`
                          : formatAmount(order.cost.grand_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
}

export default define.page<typeof handler>(function CustomerDetail({ data }) {
  return (
    <AppFrame>
      <CustomerDetailContent data={data} />
    </AppFrame>
  );
});
