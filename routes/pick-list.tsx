import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials } from "@/utils/kv.ts";
import type { BLOrder, PickListItem, PickListOrder } from "@/utils/types.ts";
import PickList from "@/islands/PickList.tsx";

export const handler = define.handlers<
  { pickList: PickListItem[]; orders: PickListOrder[]; error: string | null }
>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/settings");
    }

    const orderParam = ctx.url.searchParams.get("orders") ?? "";
    const orderIds = orderParam
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    if (orderIds.length === 0) {
      return ctx.redirect("/orders");
    }

    try {
      const client = new BricklinkClient(creds);
      const [orderDetails, itemArrays] = await Promise.all([
        Promise.all(orderIds.map((id) => client.get<BLOrder>(`/orders/${id}`))),
        Promise.all(orderIds.map((id) => client.getOrderItems(id))),
      ]);

      const orders: PickListOrder[] = orderDetails.map((o) => ({
        orderId: o.order_id,
        buyerName: o.buyer_name,
        status: o.status,
      }));

      const map = new Map<string, PickListItem>();
      orderIds.forEach((orderId, idx) => {
        for (const item of itemArrays[idx]) {
          const location = item.remarks?.trim() || "(no location)";
          const key = `${item.item.no}|${item.color_id}|${item.new_or_used}|${location}`;
          const existing = map.get(key);
          if (existing) {
            existing.quantity += item.quantity;
            existing.orderQuantities[orderId] = (existing.orderQuantities[orderId] ?? 0) + item.quantity;
            if (!existing.orderIds.includes(orderId)) {
              existing.orderIds.push(orderId);
            }
          } else {
            map.set(key, {
              itemNo: item.item.no,
              itemName: item.item.name,
              itemType: item.item.type,
              colorId: item.color_id,
              colorName: item.color_name,
              condition: item.new_or_used,
              quantity: item.quantity,
              location,
              orderIds: [orderId],
              orderQuantities: { [orderId]: item.quantity },
            });
          }
        }
      });

      const pickList = [...map.values()].sort((a, b) => {
        const locCmp = a.location.localeCompare(b.location);
        return locCmp !== 0 ? locCmp : a.itemName.localeCompare(b.itemName);
      });

      return page({ pickList, orders, error: null });
    } catch (err) {
      return page({ pickList: [], orders: [], error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function PickListPage({ data }) {
  const { pickList, orders, error } = data;
  return (
    <AppFrame>
      <div class="p-6">
        {error && (
          <div role="alert" class="alert alert-error mb-6">
            <span class="iconify lucide--alert-circle size-5"></span>
            <div>
              <div class="font-medium">Failed to generate pick list</div>
              <div class="text-sm">{error}</div>
            </div>
          </div>
        )}

        {!error && pickList.length === 0 && (
          <div class="text-center py-16 text-base-content/50">
            <span class="iconify lucide--package size-12 block mx-auto mb-3"></span>
            <p class="font-medium">No items found</p>
            <p class="text-sm mt-1">The selected orders have no items.</p>
            <a href="/orders" class="btn btn-ghost btn-sm mt-4">Back to Orders</a>
          </div>
        )}

        {pickList.length > 0 && <PickList items={pickList} orders={orders} />}
      </div>
    </AppFrame>
  );
});
