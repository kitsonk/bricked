import { useSignal } from "@preact/signals";
import type { BLOrder, PackageType } from "@/utils/types.ts";
import { humanTime } from "@/utils/format.ts";
import { StatusBadge } from "@/components/StatusBadge.tsx";

function packageLabel(pt: PackageType): string {
  const dims = `${pt.lengthCm.toFixed(1)} × ${pt.widthCm.toFixed(1)} × ${pt.heightCm.toFixed(1)} cm`;
  return `${pt.label} (${dims})`;
}

export default function ShipList(
  { orders, packageTypes }: { orders: BLOrder[]; packageTypes: PackageType[] },
) {
  const selectedPackage = useSignal<Record<number, string>>(
    Object.fromEntries(orders.map((o) => [o.order_id, ""])),
  );

  function setPackage(orderId: number, value: string) {
    selectedPackage.value = { ...selectedPackage.value, [orderId]: value };
  }

  return (
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Buyer</th>
            <th>Ordered</th>
            <th>Status</th>
            <th>Shipping Method</th>
            <th>Shipping Address</th>
            <th>Package Type</th>
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
                <td>
                  <StatusBadge status={order.status} />
                </td>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
