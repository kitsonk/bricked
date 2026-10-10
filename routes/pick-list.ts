import type { APIContext } from "astro";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, getCustomer } from "@/utils/kv.ts";
import { patchOrdersShipping } from "@/utils/orders.ts";
import type { BLOrder, PickListItem, PickListOrder } from "@/utils/types.ts";
import { decodeHtml } from "@/utils/html.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type PickListData = { pickList: PickListItem[]; orders: PickListOrder[]; error: string | null };

export async function loadPickList({ url }: APIContext): Promise<PageResult<PickListData>> {
  const creds = getCredentials();
  if (!creds) {
    return { kind: "redirect", to: "/environment" };
  }

  const orderParam = url.searchParams.get("orders") ?? "";
  const orderIds = orderParam
    .split(",")
    .map(Number)
    .filter((n) => !Number.isNaN(n) && n > 0);

  if (orderIds.length === 0) {
    return { kind: "redirect", to: "/orders" };
  }

  try {
    const client = new BricklinkClient(creds);
    const [orderDetails, itemArrays] = await Promise.all([
      Promise.all(orderIds.map((id) => client.get<BLOrder>(`/orders/${id}`))),
      Promise.all(orderIds.map((id) => client.getOrderItems(id))),
    ]);

    await patchOrdersShipping(orderDetails);

    const customers = await Promise.all(orderDetails.map((o) => getCustomer(o.buyer_name)));

    const orders: PickListOrder[] = orderDetails.map((o, i) => ({
      orderId: o.order_id,
      buyerName: o.buyer_name,
      shippingName: o.shipping.address.name.first || o.shipping.address.name.full,
      shippingMethod: o.shipping.method,
      status: o.status,
      dateOrdered: o.date_ordered,
      orderCount: customers[i]?.orderCount,
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
            itemName: decodeHtml(item.item.name),
            itemType: item.item.type,
            description: item.description,
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

    return { kind: "data", data: { pickList, orders, error: null } };
  } catch (err) {
    return { kind: "data", data: { pickList: [], orders: [], error: String(err) } };
  }
}
