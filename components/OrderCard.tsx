import type { PickListItem, PickListOrder } from "@/utils/types.ts";
import { StatusBadge } from "@/components/StatusBadge.tsx";
import { humanTime } from "@/utils/format.ts";

const PACKABLE_STATUSES = ["PENDING", "UPDATED", "PROCESSING", "READY", "PAID"];

export function itemKey(item: PickListItem) {
  return `${item.itemNo}|${item.colorId}|${item.condition}|${item.location}`;
}

export interface OrderCardProps {
  order: PickListOrder;
  items: PickListItem[];
  picked: Set<string>;
  packedOrderIds: Set<number>;
  packingOrderId: number | null;
  onPack: (orderId: number) => void;
}

export function OrderCard({ order, items, picked, packedOrderIds, packingOrderId, onPack }: OrderCardProps) {
  const orderItems = items.filter((i) => i.orderIds.includes(order.orderId));
  const totalLots = orderItems.length;
  const totalOrderPieces = orderItems.reduce((sum, i) => sum + (i.orderQuantities[order.orderId] ?? 0), 0);
  const pickedLots = orderItems.filter((i) => picked.has(itemKey(i))).length;
  const pickedPieces = orderItems.reduce(
    (sum, i) => picked.has(itemKey(i)) ? sum + (i.orderQuantities[order.orderId] ?? 0) : sum,
    0,
  );
  const done = pickedLots === totalLots && totalLots > 0;
  const isPacked = packedOrderIds.has(order.orderId);
  const canPack = done && !isPacked && PACKABLE_STATUSES.includes(order.status);
  const isPacking = packingOrderId === order.orderId;

  return (
    <div class="card border">
      <div class="card-body p-4 gap-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium">{order.buyerName}</span>
              {order.shippingName && <span class="text-sm text-base-content/50">({order.shippingName})</span>}
              {order.orderCount != null && order.orderCount > 0 && (
                <span
                  class="badge badge-xs badge-info"
                  title={`${order.orderCount} previous order${order.orderCount !== 1 ? "s" : ""}`}
                >
                  {order.orderCount}
                </span>
              )}
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-xs text-base-content/40 font-mono">#{order.orderId}</span>
              <StatusBadge status={order.status} size="xs" />
            </div>
            {order.shippingMethod && <div class="text-xs text-base-content/50 mt-0.5">{order.shippingMethod}</div>}
          </div>
          <button
            type="button"
            class={`btn btn-xs shrink-0 ${isPacked ? "btn-ghost" : "btn-primary"}`}
            disabled={isPacking || (!canPack && !isPacked)}
            onClick={() => !isPacked && onPack(order.orderId)}
          >
            {isPacking && <span class="loading loading-spinner loading-xs"></span>}
            {isPacked ? "Ship..." : "Packed"}
          </button>
        </div>
        <div class="flex gap-4 mt-1 text-sm">
          <span class="text-base-content/50">Ordered {humanTime(order.dateOrdered)}</span>
          <span>
            <span class={`font-semibold ${done ? "text-success" : ""}`}>{pickedLots}</span>
            <span class="text-base-content/50">/{totalLots} lots</span>
          </span>
          <span>
            <span class={`font-semibold ${done ? "text-success" : ""}`}>{pickedPieces}</span>
            <span class="text-base-content/50">/{totalOrderPieces} pieces</span>
          </span>
        </div>
        {totalLots > 0 && (
          <progress
            class={`progress w-full ${done ? "progress-success" : "progress-primary"}`}
            value={pickedLots}
            max={totalLots}
          />
        )}
      </div>
    </div>
  );
}
