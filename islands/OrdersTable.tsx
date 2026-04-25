import { useSignal } from "@preact/signals";
import type { BLOrderSummary } from "@/utils/types.ts";
import { formatAmount, humanTime } from "@/utils/format.ts";
import { StatusBadge } from "@/components/StatusBadge.tsx";

const STATUS_ORDER: Record<string, number> = {
  PENDING: 0,
  UPDATED: 1,
  PROCESSING: 2,
  READY: 3,
  PAID: 4,
  PACKED: 5,
  SHIPPED: 6,
  RECEIVED: 7,
  COMPLETED: 8,
  CANCELLED: 9,
};

function sortOrders(orders: BLOrderSummary[], dateSort: "asc" | "desc"): BLOrderSummary[] {
  return [...orders].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    const timeDiff = new Date(a.date_ordered).getTime() - new Date(b.date_ordered).getTime();
    return dateSort === "desc" ? -timeDiff : timeDiff;
  });
}

export default function OrdersTable(
  { orders, sentOrderIds, messageCounts, buyerOrderCounts, dateSort }: {
    orders: BLOrderSummary[];
    sentOrderIds: number[];
    messageCounts?: Record<number, number>;
    buyerOrderCounts: Record<string, number>;
    dateSort: "asc" | "desc";
  },
) {
  const sortedOrders = sortOrders(orders, dateSort);
  const selected = useSignal(new Set<number>());
  const sentSet = new Set(sentOrderIds);

  function toggle(id: number) {
    const next = new Set(selected.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selected.value = next;
  }

  function toggleAll() {
    selected.value = selected.value.size === sortedOrders.length && sortedOrders.length > 0
      ? new Set()
      : new Set(sortedOrders.map((o) => o.order_id));
  }

  const allSelected = selected.value.size === sortedOrders.length && sortedOrders.length > 0;
  const someSelected = selected.value.size > 0;
  const selectedIds = [...selected.value].join(",");

  if (sortedOrders.length === 0) {
    return (
      <div class="text-center py-16 text-base-content/50">
        <span class="iconify lucide--inbox size-12 block mx-auto mb-3"></span>
        <p class="font-medium">No orders</p>
        <p class="text-sm mt-1">Nothing here!</p>
      </div>
    );
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-base-content/60">
          {sortedOrders.length} order{sortedOrders.length !== 1 ? "s" : ""}
        </p>
        <div class="flex items-center gap-2">
          <a
            href={`/pick-list?orders=${selectedIds}`}
            class={`btn btn-primary btn-sm${!someSelected ? " btn-disabled" : ""}`}
            aria-disabled={!someSelected}
            tabIndex={someSelected ? undefined : -1}
          >
            <span class="iconify lucide--package size-4"></span>
            Generate Pick List
            {someSelected && <span class="badge badge-sm badge-primary-content ml-1">{selected.value.size}</span>}
          </a>
          <a
            href={`/ship-list?orders=${selectedIds}`}
            class={`btn btn-primary btn-sm${!someSelected ? " btn-disabled" : ""}`}
            aria-disabled={!someSelected}
            tabIndex={someSelected ? undefined : -1}
          >
            <span class="iconify lucide--truck size-4"></span>
            Prepare to Ship
            {someSelected && <span class="badge badge-sm badge-primary-content ml-1">{selected.value.size}</span>}
          </a>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th class="w-8">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th>Order</th>
              {messageCounts && <th></th>}
              <th>Buyer</th>
              <th>Created</th>
              <th>Status</th>
              <th>Items</th>
              <th class="text-right">Total</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((order) => {
              const isSelected = selected.value.has(order.order_id);
              return (
                <tr
                  key={order.order_id}
                  class={`cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a, input, button")) return;
                    toggle(order.order_id);
                  }}
                >
                  <td>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      checked={isSelected}
                      onChange={() => toggle(order.order_id)}
                      aria-label={`Select order ${order.order_id}`}
                    />
                  </td>
                  <td>
                    <a class="link font-mono font-medium" href={`/orders/${order.order_id}`}>
                      #{order.order_id}
                    </a>
                  </td>
                  {messageCounts && (
                    <td class="text-sm">
                      {(messageCounts[order.order_id] ?? 0) > 0 && (
                        <span class="flex items-center gap-1 text-primary">
                          <span class="iconify lucide--message-circle size-4"></span>
                          {messageCounts[order.order_id]}
                        </span>
                      )}
                    </td>
                  )}
                  <td class="font-medium">
                    <a
                      class="link"
                      href={`/customers/${order.buyer_name}`}
                      f-partial={`/partials/customers/${order.buyer_name}`}
                    >
                      {order.buyer_name}
                    </a>
                    {(buyerOrderCounts[order.buyer_name] ?? 0) > 0 && (
                      <span class="text-base-content/50 font-normal ml-1">
                        ({buyerOrderCounts[order.buyer_name]})
                      </span>
                    )}
                  </td>
                  <td class="text-sm">{humanTime(order.date_ordered)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td class="text-sm">
                    {order.total_count} <span class="text-base-content/50">({order.unique_count} lots)</span>
                  </td>
                  <td class="text-right font-medium">
                    {order.cost.currency_code} {formatAmount(order.cost.grand_total)}
                  </td>
                  <td>
                    <div class="flex items-center gap-1">
                      {!sentSet.has(order.order_id) && (
                        <a
                          href={`/drive-thru/${order.order_id}`}
                          class={`btn btn-ghost btn-xs btn-square ${
                            order.status === "SHIPPED" ? "text-info" : "text-base-content/40"
                          }`}
                          title="Send Drive Thru"
                        >
                          <span class="iconify lucide--send size-3.5"></span>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
