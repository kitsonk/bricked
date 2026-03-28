import { useSignal } from "@preact/signals";
import type { BLOrder, OrderStatus } from "@/utils/types.ts";
import { ShipOrderDialog } from "@/components/ShipOrderDialog.tsx";
import type { ShipFormData } from "@/components/ShipOrderDialog.tsx";

export default function OrderShipButton(
  { order: initialOrder, hasTracking }: { order: BLOrder; hasTracking: boolean },
) {
  const dialogOpen = useSignal(false);
  const shipped = useSignal(false);
  const loading = useSignal(false);
  const error = useSignal<string | null>(null);
  const order = useSignal<BLOrder>(initialOrder);

  async function shipOrder(data: ShipFormData) {
    loading.value = true;
    error.value = null;
    try {
      const resp = await fetch(`/api/orders/${order.value.order_id}/ship`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      order.value = { ...order.value, status: "SHIPPED" as OrderStatus };
      shipped.value = true;
      dialogOpen.value = false;
    } catch (err) {
      error.value = String(err);
    } finally {
      loading.value = false;
    }
  }

  if (shipped.value) return null;

  return (
    <>
      {error.value && (
        <div role="alert" class="alert alert-error mt-2 text-sm">
          <span class="iconify lucide--alert-circle size-4"></span>
          <div>{error.value}</div>
        </div>
      )}
      <button
        type="button"
        class="btn btn-primary btn-sm"
        disabled={loading.value}
        onClick={() => (dialogOpen.value = true)}
      >
        {loading.value
          ? <span class="loading loading-spinner loading-xs"></span>
          : <span class="iconify lucide--truck size-4"></span>}
        Ship Order
      </button>
      <ShipOrderDialog
        order={order.value}
        hasTracking={hasTracking}
        isOpen={dialogOpen.value}
        onConfirm={shipOrder}
        onClose={() => (dialogOpen.value = false)}
      />
    </>
  );
}
