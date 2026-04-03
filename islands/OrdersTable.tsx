import { useSignal } from "@preact/signals";
import type { BLOrder, OrderStatus } from "@/utils/types.ts";
import { formatAmount, humanTime } from "@/utils/format.ts";
import { StatusBadge } from "@/components/StatusBadge.tsx";
import { ShipOrderDialog } from "@/components/ShipOrderDialog.tsx";
import type { ShipFormData } from "@/components/ShipOrderDialog.tsx";

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

function sortOrders(orders: BLOrder[], dateSort: "asc" | "desc"): BLOrder[] {
  return [...orders].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    const timeDiff = new Date(a.date_ordered).getTime() - new Date(b.date_ordered).getTime();
    return dateSort === "desc" ? -timeDiff : timeDiff;
  });
}

export default function OrdersTable(
  { orders, trackingMethodIds, dateSort }: { orders: BLOrder[]; trackingMethodIds: number[]; dateSort: "asc" | "desc" },
) {
  const trackingMethodSet = new Set(trackingMethodIds);
  const localOrders = useSignal<BLOrder[]>(sortOrders(orders, dateSort));
  const selected = useSignal(new Set<number>());
  const shippingOrder = useSignal<BLOrder | null>(null);
  const shipError = useSignal<string | null>(null);
  const shipLoading = useSignal(false);
  const shipDialogLoading = useSignal<number | null>(null);

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
    selected.value = selected.value.size === localOrders.value.length && localOrders.value.length > 0
      ? new Set()
      : new Set(localOrders.value.map((o) => o.order_id));
  }

  function generatePickList() {
    const ids = [...selected.value].join(",");
    globalThis.location.href = `/pick-list?orders=${ids}`;
  }

  function prepareToShip() {
    const ids = [...selected.value].join(",");
    globalThis.location.href = `/ship-list?orders=${ids}`;
  }

  async function openShipDialog(orderId: number) {
    shipDialogLoading.value = orderId;
    shipError.value = null;
    try {
      const resp = await fetch(`/api/orders/${orderId}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const order: BLOrder = await resp.json();
      shippingOrder.value = order;
    } catch (err) {
      shipError.value = String(err);
    } finally {
      shipDialogLoading.value = null;
    }
  }

  async function shipOrder(data: ShipFormData) {
    const order = shippingOrder.value;
    if (!order) return;
    shipLoading.value = true;
    shipError.value = null;
    try {
      const resp = await fetch(`/api/orders/${order.order_id}/ship`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      localOrders.value = sortOrders(
        localOrders.value.map((o) => o.order_id === order.order_id ? { ...o, status: "SHIPPED" as OrderStatus } : o),
        dateSort,
      );
      shippingOrder.value = null;
    } catch (err) {
      shipError.value = String(err);
    } finally {
      shipLoading.value = false;
    }
  }

  const allSelected = selected.value.size === localOrders.value.length && localOrders.value.length > 0;
  const someSelected = selected.value.size > 0;

  if (localOrders.value.length === 0) {
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
      {shipError.value && (
        <div role="alert" class="alert alert-error mb-4">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{shipError.value}</div>
        </div>
      )}

      <ShipOrderDialog
        order={shippingOrder.value}
        hasTracking={trackingMethodSet.has(shippingOrder.value?.shipping?.method_id ?? -1)}
        isOpen={shippingOrder.value !== null}
        onConfirm={shipOrder}
        onClose={() => (shippingOrder.value = null)}
      />

      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-base-content/60">
          {localOrders.value.length} order{localOrders.value.length !== 1 ? "s" : ""}
        </p>
        <div class="flex items-center gap-2">
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
          <button
            type="button"
            class="btn btn-primary btn-sm"
            disabled={!someSelected}
            onClick={prepareToShip}
          >
            <span class="iconify lucide--truck size-4"></span>
            Prepare to Ship
            {someSelected && <span class="badge badge-sm badge-primary-content ml-1">{selected.value.size}</span>}
          </button>
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
              <th>Buyer</th>
              <th>Created</th>
              <th>Status</th>
              <th>Items</th>
              <th class="text-right">Total</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {localOrders.value.map((order) => {
              const isSelected = selected.value.has(order.order_id);
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
                  <td class="text-sm">{humanTime(order.date_ordered)}</td>
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
                    <div class="flex items-center gap-1">
                      {order.status === "PACKED" && (
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs btn-square text-info"
                          title="Ship order"
                          disabled={shipDialogLoading.value === order.order_id || shipLoading.value}
                          onClick={() => openShipDialog(order.order_id)}
                        >
                          {shipDialogLoading.value === order.order_id
                            ? <span class="loading loading-spinner loading-xs"></span>
                            : <span class="iconify lucide--truck size-3.5"></span>}
                        </button>
                      )}
                      {!order.drive_thru_sent && (
                        <a
                          href={`/drive-thru/${order.order_id}`}
                          class={`btn btn-ghost btn-xs btn-square ${
                            order.status === "SHIPPED" ? "text-info" : "text-base-content/40"
                          }`}
                          title="Send Drive Thru"
                          onClick={(e) => e.stopPropagation()}
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
