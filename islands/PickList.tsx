import { useSignal } from "@preact/signals";
import type { PickListItem, PickListOrder } from "@/utils/types.ts";
import { ConditionBadge } from "@/components/ConditionBadge.tsx";
import { bricklinkItemImageUrl } from "@/utils/format.ts";
import { itemKey, OrderCard } from "@/components/OrderCard.tsx";
import { type PartDialogItem, PartImageDialog } from "@/components/PartImageDialog.tsx";

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
  const packedOrderIds = useSignal(new Set<number>());
  const packingOrderId = useSignal<number | null>(null);
  const packError = useSignal<string | null>(null);
  const dialogItem = useSignal<PartDialogItem | null>(null);

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

  async function packOrder(orderId: number) {
    packingOrderId.value = orderId;
    packError.value = null;
    try {
      const resp = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PACKED" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      const next = new Set(packedOrderIds.value);
      next.add(orderId);
      packedOrderIds.value = next;
    } catch (err) {
      packError.value = String(err);
    } finally {
      packingOrderId.value = null;
    }
  }

  const byLocation = groupBy(items, (item) => item.location);
  const totalPieces = items.reduce((sum, i) => sum + i.quantity, 0);
  const pickedCount = picked.value.size;
  const buyerByOrderId = new Map(orders.map((o) => [o.orderId, o.buyerName]));

  const allPacked = orders.length > 0 &&
    orders.every((o) => o.status === "PACKED" || packedOrderIds.value.has(o.orderId));
  const shipListHref = `/ship-list?orders=${orders.map((o) => o.orderId).join(",")}`;

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
          <a
            href={shipListHref}
            class={`btn btn-primary btn-sm ${!allPacked ? "btn-disabled" : ""}`}
            aria-disabled={!allPacked}
            title={!allPacked ? "All orders must be Packed before preparing to ship" : undefined}
          >
            <span class="iconify lucide--truck size-4"></span>
            Prepare to Ship
          </a>
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

      {packError.value && (
        <div role="alert" class="alert alert-error mb-4 print:hidden">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{packError.value}</div>
        </div>
      )}

      {orders.length > 0 && (
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 print:hidden">
          {orders.map((order) => (
            <OrderCard
              key={order.orderId}
              order={order}
              items={items}
              picked={picked.value}
              packedOrderIds={packedOrderIds.value}
              packingOrderId={packingOrderId.value}
              onPack={packOrder}
            />
          ))}
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
                    <th colSpan={5}>
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
                            <button
                              type="button"
                              class="shrink-0 cursor-zoom-in"
                              onClick={(e) => {
                                e.stopPropagation();
                                dialogItem.value = {
                                  itemNo: item.itemNo,
                                  itemName: item.itemName,
                                  itemType: item.itemType,
                                  colorId: item.colorId,
                                  colorName: item.colorName,
                                  description: item.description,
                                };
                              }}
                              aria-label={`View image for ${item.itemName}`}
                            >
                              <img
                                src={bricklinkItemImageUrl(item.itemType, item.itemNo, item.colorId)}
                                alt={item.itemName}
                                class="size-10 object-contain"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.parentElement!.style.display = "none";
                                }}
                              />
                            </button>
                            <div>
                              <a
                                href={`https://www.bricklink.com/v2/catalog/catalogitem.page?P=${item.itemNo}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                class={`font-medium link link-hover ${isPicked ? "line-through" : ""}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {item.itemName}
                              </a>
                              <div class="text-xs text-base-content/50 font-mono">{item.itemNo}</div>
                              {item.description && (
                                <div class="text-xs text-base-content/50 whitespace-normal">{item.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td class="text-sm">{item.colorName}</td>
                        <td>
                          <ConditionBadge condition={item.condition} />
                        </td>
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

      <PartImageDialog item={dialogItem.value} onClose={() => (dialogItem.value = null)} />
    </div>
  );
}
