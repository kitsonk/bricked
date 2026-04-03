import { useSignal } from "@preact/signals";
import type { BLOrder, PackageType } from "@/utils/types.ts";
import { humanTime } from "@/utils/format.ts";

interface Dims {
  l: string;
  w: string;
  h: string;
}

function packageLabel(pt: PackageType): string {
  const dims = `${pt.lengthCm.toFixed(1)} × ${pt.widthCm.toFixed(1)} × ${pt.heightCm.toFixed(1)} cm`;
  return `${pt.label} (${dims})`;
}

export default function ShipList(
  { orders, packageTypes }: { orders: BLOrder[]; packageTypes: PackageType[] },
) {
  const packageById = new Map(packageTypes.map((pt) => [pt.id, pt]));

  const selectedPackage = useSignal<Record<number, string>>(
    Object.fromEntries(orders.map((o) => [o.order_id, ""])),
  );

  const dimensions = useSignal<Record<number, Dims>>(
    Object.fromEntries(orders.map((o) => [o.order_id, { l: "", w: "", h: "" }])),
  );

  function setPackage(orderId: number, value: string) {
    selectedPackage.value = { ...selectedPackage.value, [orderId]: value };
    const pt = packageById.get(value);
    dimensions.value = {
      ...dimensions.value,
      [orderId]: pt
        ? { l: pt.lengthCm.toFixed(1), w: pt.widthCm.toFixed(1), h: pt.heightCm.toFixed(1) }
        : { l: "", w: "", h: "" },
    };
  }

  function setDim(orderId: number, field: keyof Dims, value: string) {
    dimensions.value = {
      ...dimensions.value,
      [orderId]: { ...dimensions.value[orderId], [field]: value },
    };
  }

  return (
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Buyer</th>
            <th>Ordered</th>
            <th>Shipping Method</th>
            <th>Shipping Address</th>
            <th>Package Type</th>
            <th>L (cm)</th>
            <th>W (cm)</th>
            <th>H (cm)</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const addr = order.shipping?.address;
            const addressLine = addr
              ? [addr.address1, addr.address2, addr.city, addr.state, addr.postal_code, addr.country_code]
                .filter(Boolean)
                .join(", ")
              : "—";
            const isCustom = selectedPackage.value[order.order_id] === "";
            const dims = dimensions.value[order.order_id];
            return (
              <tr key={order.order_id}>
                <td>
                  <a class="link font-mono font-medium" href={`/orders/${order.order_id}`}>
                    #{order.order_id}
                  </a>
                </td>
                <td>
                  <div class="font-medium">{order.buyer_name}</div>
                  <div class="text-xs text-base-content/50">{order.buyer_email}</div>
                </td>
                <td class="text-sm">{humanTime(order.date_ordered)}</td>
                <td class="text-sm">{order.shipping?.method || "—"}</td>
                <td class="text-sm">{addressLine}</td>
                <td>
                  <select
                    class="select select-sm w-full min-w-48"
                    value={selectedPackage.value[order.order_id]}
                    onChange={(e) => setPackage(order.order_id, (e.target as HTMLSelectElement).value)}
                  >
                    <option value="">Custom</option>
                    {packageTypes.map((pt) => <option key={pt.id} value={pt.id}>{packageLabel(pt)}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    class="input input-sm w-20"
                    step="0.1"
                    min="0"
                    disabled={!isCustom}
                    value={dims.l}
                    onInput={(e) => setDim(order.order_id, "l", (e.target as HTMLInputElement).value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    class="input input-sm w-20"
                    step="0.1"
                    min="0"
                    disabled={!isCustom}
                    value={dims.w}
                    onInput={(e) => setDim(order.order_id, "w", (e.target as HTMLInputElement).value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    class="input input-sm w-20"
                    step="0.1"
                    min="0"
                    disabled={!isCustom}
                    value={dims.h}
                    onInput={(e) => setDim(order.order_id, "h", (e.target as HTMLInputElement).value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
