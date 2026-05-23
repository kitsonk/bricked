import type { BLOrder } from "@/utils/types.ts";
import { getShippingOverride } from "@/utils/kv.ts";

/**
 * Apply a locally-stored shipping method override to a single order.
 * Mutates the order in place and returns it.
 */
export async function patchOrderShipping<T extends Pick<BLOrder, "order_id" | "shipping">>(
  order: T,
): Promise<T> {
  const override = await getShippingOverride(order.order_id);
  if (override) {
    order.shipping.method = override.methodName;
    order.shipping.method_id = override.methodId;
  }
  return order;
}

/**
 * Apply shipping overrides to a batch of orders.
 * Mutates each order in place.
 */
export async function patchOrdersShipping(orders: BLOrder[]): Promise<BLOrder[]> {
  await Promise.all(orders.map((o) => patchOrderShipping(o)));
  return orders;
}
