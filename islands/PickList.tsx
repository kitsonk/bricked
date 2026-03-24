import { useSignal } from "@preact/signals";
import type { PickListItem, PickListOrder } from "@/utils/types.ts";

const ITEM_TYPE_CODE: Record<string, string> = {
  PART: "P",
  MINIFIG: "M",
  SET: "S",
  BOOK: "B",
  GEAR: "G",
  CATALOG: "C",
  INSTRUCTION: "I",
  ORIGINAL_BOX: "O",
  UNSORTED_LOT: "U",
};

function bricklinkItemImageUrl(itemType: string, itemNo: string, colorId: number): string {
  const prefix = ITEM_TYPE_CODE[itemType] ?? itemType;
  const typeCode = prefix + "N";
  const colorSegment = itemType === "PART" ? colorId : 0;
  return `https://img.bricklink.com/ItemImage/${typeCode}/${colorSegment}/${itemNo}.png`;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}

export default function PickList({ items, orders }: { items: PickListItem[]; orders: PickListOrder[] }) {
  const picked = useSignal(new Set<string>());

  function itemKey(item: PickListItem) {
    return `${item.itemNo}|${item.colorId}|${item.condition}|${item.location}`;
  }

  function togglePicked(key: string) {
    const next = new Set(picked.value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    picked.value = next;
  }

  function resetAll() {
    picked.value = new Set();
  }

  const byLocation = groupBy(items, (item) => item.location);
  const totalPieces = items.reduce((sum, i) => sum + i.quantity, 0);
  const pickedCount = picked.value.size;
  const buyerByOrderId = new Map(orders.map((o) => [o.orderId, o.buyerName]));

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Pick List</h1>
        </div>
        <div class="flex gap-2 print:hidden">
          <a href="/orders" class="btn btn-ghost btn-sm">
            <span class="iconify lucide--arrow-left size-4"></span>
            Back
          </a>
          {pickedCount > 0 && (
            <button type="button" class="btn btn-ghost btn-sm" onClick={resetAll}>
              <span class="iconify lucide--rotate-ccw size-4"></span>
              Reset
            </button>
          )}
          <button type="button" class="btn btn-primary btn-sm" onClick={() => globalThis.print()}>
            <span class="iconify lucide--printer size-4"></span>
            Print
          </button>
        </div>
      </div>

      <div class="flex gap-4 mb-6 text-sm text-base-content/60 print:hidden">
        <span>
          <span class="font-medium text-base-content">{items.length}</span> lots
        </span>
        <span>
          <span class="font-medium text-base-content">{totalPieces}</span> pieces
        </span>
        <span>
          <span class="font-medium text-base-content">{byLocation.size}</span> locations
        </span>
        {pickedCount > 0 && (
          <span class="text-success">
            <span class="font-medium">{pickedCount}</span> picked
          </span>
        )}
      </div>

      {orders.length > 0 && (
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 print:hidden">
          {orders.map((order) => {
            const orderItems = items.filter((i) => i.orderIds.includes(order.orderId));
            const totalLots = orderItems.length;
            const totalOrderPieces = orderItems.reduce((sum, i) => sum + (i.orderQuantities[order.orderId] ?? 0), 0);
            const pickedLots = orderItems.filter((i) => picked.value.has(itemKey(i))).length;
            const pickedPieces = orderItems.reduce(
              (sum, i) => picked.value.has(itemKey(i)) ? sum + (i.orderQuantities[order.orderId] ?? 0) : sum,
              0,
            );
            const done = pickedLots === totalLots;
            return (
              <div key={order.orderId} class={`card border transition-opacity ${done ? "opacity-60" : "bg-base-200"}`}>
                <div class="card-body p-4 gap-2">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold">#{order.orderId}</span>
                    <span class="text-base-content/50">·</span>
                    <span class="text-sm text-base-content/70">{order.buyerName}</span>
                  </div>
                  <div class="flex gap-4 mt-1 text-sm">
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
          })}
        </div>
      )}

      <div class="overflow-x-auto rounded-box border border-base-content/10">
        <table class="table table-sm table-pin-rows">
          {[...byLocation.entries()].map(([location, locationItems]) => {
            const allPicked = locationItems.every((i) => picked.value.has(itemKey(i)));
            return (
              <>
                <thead key={`head-${location}`}>
                  <tr>
                    <th colSpan={4}>
                      <span class="flex items-center gap-2">
                        <span
                          class={`iconify lucide--map-pin size-3.5 ${allPicked ? "text-success" : "text-primary"}`}
                        >
                        </span>
                        <span class={allPicked ? "line-through text-base-content/40" : ""}>{location}</span>
                        <span class="badge badge-xs badge-ghost">
                          {locationItems.length} lot{locationItems.length !== 1 ? "s" : ""}
                        </span>
                      </span>
                    </th>
                    <th class="print:hidden"></th>
                  </tr>
                </thead>
                <tbody key={`body-${location}`}>
                  {locationItems.map((item) => {
                    const key = itemKey(item);
                    const isPicked = picked.value.has(key);
                    return (
                      <tr
                        key={key}
                        class={`cursor-pointer transition-all ${isPicked ? "opacity-40" : ""}`}
                        onClick={() => togglePicked(key)}
                      >
                        <td class="print:hidden">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-sm checkbox-success"
                            checked={isPicked}
                            onChange={() => togglePicked(key)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Mark as picked"
                          />
                        </td>
                        <td>
                          <div class="flex items-center gap-3">
                            <img
                              src={bricklinkItemImageUrl(item.itemType, item.itemNo, item.colorId)}
                              alt={item.itemName}
                              class="size-10 object-contain shrink-0"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                            <div>
                              <div class={`font-medium ${isPicked ? "line-through" : ""}`}>{item.itemName}</div>
                              <div class="text-xs text-base-content/50 font-mono">{item.itemNo}</div>
                            </div>
                          </div>
                        </td>
                        <td class="text-sm">{item.colorName}</td>
                        <td class="text-right font-bold text-lg">{item.quantity}</td>
                        <td class="text-xs text-base-content/50 print:hidden">
                          {item.orderIds.map((id) => `#${id} (${buyerByOrderId.get(id) ?? ""})`).join(", ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            );
          })}
        </table>
      </div>
    </div>
  );
}
