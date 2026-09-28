import type { APIContext } from "astro";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, getCustomer, getShippingMethodEnrichment, getShippingOverride } from "@/utils/kv.ts";
import type { BLOrder, BLOrderItem, BLOrderMessage, Customer } from "@/utils/types.ts";
import { patchOrderShipping } from "@/utils/orders.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type OrderDetailData = {
  order: BLOrder | null;
  items: BLOrderItem[];
  messages: BLOrderMessage[];
  customer: Customer | null;
  hasTracking: boolean;
  shippingOverridden: boolean;
  error: string | null;
};

export async function loadOrderDetail({ params }: APIContext): Promise<PageResult<OrderDetailData>> {
  const creds = getCredentials();
  if (!creds) {
    return { kind: "redirect", to: "/environment" };
  }
  const orderId = Number(params.id);
  if (isNaN(orderId)) {
    return { kind: "notFound" };
  }
  try {
    const client = new BricklinkClient(creds);
    const [order, items, messages] = await Promise.all([
      client.get<BLOrder>(`/orders/${orderId}`),
      client.getOrderItems(orderId),
      client.getOrderMessages(orderId),
    ]);
    await patchOrderShipping(order);
    const [enrichment, customer, override] = await Promise.all([
      order.shipping?.method_id ? getShippingMethodEnrichment(order.shipping.method_id) : Promise.resolve(null),
      getCustomer(order.buyer_name),
      getShippingOverride(order.order_id),
    ]);
    return {
      kind: "data",
      data: {
        order,
        items,
        messages,
        customer,
        hasTracking: enrichment?.hasTracking ?? false,
        shippingOverridden: override !== null,
        error: null,
      },
    };
  } catch (err) {
    return {
      kind: "data",
      data: {
        order: null,
        items: [],
        messages: [],
        customer: null,
        hasTracking: false,
        shippingOverridden: false,
        error: String(err),
      },
    };
  }
}
