import { useSignal } from "@preact/signals";
import type { BLOrder } from "@/utils/types.ts";
import { formatAmount } from "@/utils/format.ts";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "badge-warning",
  UPDATED: "badge-info",
  PROCESSING: "badge-primary",
  READY: "badge-success",
  PAID: "badge-success",
  PACKED: "badge-neutral",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span class={`badge badge-sm ${STATUS_COLORS[status] ?? "badge-ghost"}`}>
      {status}
    </span>
  );
}

export default function OrdersTable({ orders, sentDriveThruIds }: { orders: BLOrder[]; sentDriveThruIds: number[] }) {
  const sentSet = new Set(sentDriveThruIds);
  const selected = useSignal(new Set<number>());

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
    selected.value = selected.value.size === orders.length && orders.length > 0
      ? new Set()
      : new Set(orders.map((o) => o.order_id));
  }

  function generatePickList() {
    const ids = [...selected.value].join(",");
    globalThis.location.href = `/pick-list?orders=${ids}`;
  }

  const allSelected = selected.value.size === orders.length && orders.length > 0;
  const someSelected = selected.value.size > 0;

  if (orders.length === 0) {
    return (
      <div class="text-center py-16 text-base-content/50">
        <span class="iconify lucide--inbox size-12 block mx-auto mb-3"></span>
        <p class="font-medium">No unfulfilled orders</p>
        <p class="text-sm mt-1">All caught up!</p>
      </div>
    );
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-base-content/60">
          {orders.length} order{orders.length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          disabled={!someSelected}
          onClick={generatePickList}
        >
          <span class="iconify lucide--package size-4"></span>
          Generate Pick List
          {someSelected && <span class="badge badge-sm badge-primary-content ml-1">{selected.value.size}</span>}
        </button>
      </div>

      <div class="overflow-x-auto rounded-box border border-base-content/10">
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
              <th>Buyer</th>
              <th>Date</th>
              <th>Status</th>
              <th>Items</th>
              <th class="text-right">Total</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isSelected = selected.value.has(order.order_id);
              const driveThruSent = sentSet.has(order.order_id);
              return (
                <tr
                  key={order.order_id}
                  class={`cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                  onClick={() => toggle(order.order_id)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      checked={isSelected}
                      onChange={() => toggle(order.order_id)}
                      aria-label={`Select order ${order.order_id}`}
                    />
                  </td>
                  <td>
                    <a
                      class="link font-mono font-medium"
                      href={`/orders/${order.order_id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{order.order_id}
                    </a>
                  </td>
                  <td>
                    <div class="font-medium">{order.buyer_name}</div>
                    <div class="text-xs text-base-content/50">{order.buyer_email}</div>
                  </td>
                  <td class="text-sm">{new Date(order.date_ordered).toLocaleDateString()}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td class="text-sm">
                    {order.total_count} <span class="text-base-content/50">({order.unique_count} lots)</span>
                  </td>
                  <td class="text-right font-medium">
                    {order.disp_cost.currency_code} {formatAmount(order.disp_cost.grand_total)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div class="indicator">
                      {driveThruSent && (
                        <span class="indicator-item badge badge-success badge-xs" title="Drive Thru sent"></span>
                      )}
                      <a
                        href={`/drive-thru/${order.order_id}`}
                        class={`btn btn-ghost btn-xs btn-square ${
                          driveThruSent ? "text-success" : "text-base-content/40"
                        }`}
                        title={driveThruSent ? "Drive Thru sent — send again" : "Send Drive Thru"}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span class="iconify lucide--send size-3.5"></span>
                      </a>
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
