import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, getShipListAddress, listPackageTypes, listShippingMethodEnrichments } from "@/utils/kv.ts";
import type { AusPostAddress, BLOrder, PackageType } from "@/utils/types.ts";
import ShipList from "@/islands/ShipList.tsx";

function deriveAddress(order: BLOrder): AusPostAddress {
  const addr = order.shipping?.address;
  return {
    recipientName: addr?.name.full || [addr?.name.first, addr?.name.last].filter(Boolean).join(" ") || "",
    addressLine1: addr?.address1 || "",
    addressLine2: addr?.address2 || "",
    addressLine3: "",
    suburb: addr?.city || "",
    state: addr?.state || "",
    postcode: addr?.postal_code || "",
  };
}

export const handler = define.handlers<{
  orders: BLOrder[];
  packageTypes: PackageType[];
  addresses: Record<number, AusPostAddress>;
  trackingMethodIds: number[];
  error: string | null;
}>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) return ctx.redirect("/environment");

    const orderParam = ctx.url.searchParams.get("orders") ?? "";
    const orderIds = orderParam
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    if (orderIds.length === 0) return ctx.redirect("/orders");

    try {
      const client = new BricklinkClient(creds);
      const [orders, packageTypes, savedAddresses, enrichments] = await Promise.all([
        Promise.all(orderIds.map((id) => client.get<BLOrder>(`/orders/${id}`))),
        listPackageTypes(),
        Promise.all(orderIds.map((id) => getShipListAddress(id))),
        listShippingMethodEnrichments(),
      ]);

      const trackingMethodIds = [...enrichments.entries()]
        .filter(([, e]) => e.hasTracking)
        .map(([id]) => id);

      const addresses: Record<number, AusPostAddress> = {};
      orders.forEach((order, idx) => {
        addresses[order.order_id] = savedAddresses[idx] ?? deriveAddress(order);
      });

      return page({ orders, packageTypes, addresses, trackingMethodIds, error: null });
    } catch (err) {
      return page({ orders: [], packageTypes: [], addresses: {}, trackingMethodIds: [], error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function ShipListPage({ data }) {
  const { orders, packageTypes, error } = data;
  return (
    <AppFrame>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">Prepare to Ship</h1>
        <a href="/orders" class="btn btn-ghost btn-sm">
          <span class="iconify lucide--arrow-left size-4"></span>
          Back to Orders
        </a>
      </div>

      {error && (
        <div role="alert" class="alert alert-error mb-6">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>
            <div class="font-medium">Failed to load orders</div>
            <div class="text-sm">{error}</div>
          </div>
        </div>
      )}

      {!error && orders.length === 0 && (
        <div class="text-center py-16 text-base-content/50">
          <span class="iconify lucide--truck size-12 block mx-auto mb-3"></span>
          <p class="font-medium">No orders selected</p>
          <a href="/orders" class="btn btn-ghost btn-sm mt-4">Back to Orders</a>
        </div>
      )}

      {orders.length > 0 && (
        <ShipList
          orders={orders}
          packageTypes={packageTypes}
          addresses={data.addresses}
          trackingMethodIds={data.trackingMethodIds}
        />
      )}
    </AppFrame>
  );
});
