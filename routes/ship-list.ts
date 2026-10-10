import type { APIContext } from "astro";
import { BricklinkClient } from "@/utils/bricklink.ts";
import {
  getCredentials,
  getShipListAddress,
  getShippingMethodsCache,
  listPackageTypes,
  listShippingMethodEnrichments,
} from "@/utils/kv.ts";
import type { AusPostAddress, BLOrder, BLShippingMethod, PackageType } from "@/utils/types.ts";
import { patchOrdersShipping } from "@/utils/orders.ts";
import type { PageResult } from "@/routes/pageResult.ts";

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

export type ShipListData = {
  orders: BLOrder[];
  packageTypes: PackageType[];
  addresses: Record<number, AusPostAddress>;
  trackingMethodIds: number[];
  printLabelMethodIds: number[];
  shippingMethods: BLShippingMethod[];
  error: string | null;
};

export async function loadShipList({ url }: APIContext): Promise<PageResult<ShipListData>> {
  const creds = getCredentials();
  if (!creds) return { kind: "redirect", to: "/environment" };

  const orderParam = url.searchParams.get("orders") ?? "";
  const orderIds = orderParam
    .split(",")
    .map(Number)
    .filter((n) => !Number.isNaN(n) && n > 0);

  if (orderIds.length === 0) return { kind: "redirect", to: "/orders" };

  try {
    const client = new BricklinkClient(creds);
    const [rawOrders, packageTypes, savedAddresses, enrichments, shippingMethodsCache] = await Promise.all([
      Promise.all(orderIds.map((id) => client.get<BLOrder>(`/orders/${id}`))),
      listPackageTypes(),
      Promise.all(orderIds.map((id) => getShipListAddress(id))),
      listShippingMethodEnrichments(),
      getShippingMethodsCache(),
    ]);

    await patchOrdersShipping(rawOrders);
    const orders = rawOrders;
    const shippingMethods = shippingMethodsCache?.methods ?? [];

    const trackingMethodIds = [...enrichments.entries()].filter(([, e]) => e.hasTracking).map(([id]) => id);
    const printLabelMethodIds = [...enrichments.entries()].filter(([, e]) => e.printLabel).map(([id]) => id);

    const addresses: Record<number, AusPostAddress> = {};
    orders.forEach((order, idx) => {
      addresses[order.order_id] = savedAddresses[idx] ?? deriveAddress(order);
    });

    return {
      kind: "data",
      data: {
        orders,
        packageTypes,
        addresses,
        trackingMethodIds,
        printLabelMethodIds,
        shippingMethods,
        error: null,
      },
    };
  } catch (err) {
    return {
      kind: "data",
      data: {
        orders: [],
        packageTypes: [],
        addresses: {},
        trackingMethodIds: [],
        printLabelMethodIds: [],
        shippingMethods: [],
        error: String(err),
      },
    };
  }
}
