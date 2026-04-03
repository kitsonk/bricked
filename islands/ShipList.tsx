import { useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { AusPostAddress, BLOrder, PackageType } from "@/utils/types.ts";
import { humanTime } from "@/utils/format.ts";

interface Dims {
  l: string;
  w: string;
  h: string;
}

const EMPTY_ADDRESS: AusPostAddress = {
  recipientName: "",
  addressLine1: "",
  addressLine2: "",
  suburb: "",
  state: "",
  postcode: "",
};

function packageLabel(pt: PackageType): string {
  const dims = `${pt.lengthCm.toFixed(1)} × ${pt.widthCm.toFixed(1)} × ${pt.heightCm.toFixed(1)} cm`;
  return `${pt.label} (${dims})`;
}

export default function ShipList(
  { orders, packageTypes, addresses: initialAddresses }: {
    orders: BLOrder[];
    packageTypes: PackageType[];
    addresses: Record<number, AusPostAddress>;
  },
) {
  const packageById = new Map(packageTypes.map((pt) => [pt.id, pt]));

  const selectedPackage = useSignal<Record<number, string>>(
    Object.fromEntries(orders.map((o) => [o.order_id, ""])),
  );

  const dimensions = useSignal<Record<number, Dims>>(
    Object.fromEntries(orders.map((o) => [o.order_id, { l: "", w: "", h: "" }])),
  );

  const addresses = useSignal<Record<number, AusPostAddress>>(initialAddresses);
  const editingOrderId = useSignal<number | null>(null);
  const formAddress = useSignal<AusPostAddress>(EMPTY_ADDRESS);
  const saving = useSignal(false);
  const addressError = useSignal<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  function openAddressDialog(orderId: number) {
    editingOrderId.value = orderId;
    formAddress.value = { ...addresses.value[orderId] };
    addressError.value = null;
    dialogRef.current?.showModal();
  }

  function closeAddressDialog() {
    dialogRef.current?.close();
    editingOrderId.value = null;
  }

  function updateForm(field: keyof AusPostAddress, value: string) {
    formAddress.value = { ...formAddress.value, [field]: value };
  }

  async function saveAddress(e: Event) {
    e.preventDefault();
    const orderId = editingOrderId.value;
    if (orderId === null) return;
    saving.value = true;
    addressError.value = null;
    try {
      const resp = await fetch(`/api/ship-list/${orderId}/address`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formAddress.value),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      addresses.value = { ...addresses.value, [orderId]: { ...formAddress.value } };
      closeAddressDialog();
    } catch (err) {
      addressError.value = String(err);
    } finally {
      saving.value = false;
    }
  }

  return (
    <div>
      <dialog ref={dialogRef} class="modal">
        <div class="modal-box max-w-md">
          <h3 class="text-lg font-bold mb-4">Edit Recipient Address</h3>
          {addressError.value && (
            <div role="alert" class="alert alert-error mb-4 text-sm">
              <span class="iconify lucide--alert-circle size-4"></span>
              <span>{addressError.value}</span>
            </div>
          )}
          <form onSubmit={saveAddress}>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Recipient contact name *</legend>
              <input
                type="text"
                class="input input-sm w-full"
                required
                value={formAddress.value.recipientName}
                onInput={(e) => updateForm("recipientName", (e.target as HTMLInputElement).value)}
              />
            </fieldset>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Address line 1 *</legend>
              <input
                type="text"
                class="input input-sm w-full"
                required
                value={formAddress.value.addressLine1}
                onInput={(e) => updateForm("addressLine1", (e.target as HTMLInputElement).value)}
              />
            </fieldset>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Address line 2</legend>
              <input
                type="text"
                class="input input-sm w-full"
                value={formAddress.value.addressLine2}
                onInput={(e) => updateForm("addressLine2", (e.target as HTMLInputElement).value)}
              />
            </fieldset>
            <div class="grid grid-cols-3 gap-3 mb-3">
              <fieldset class="fieldset col-span-1">
                <legend class="fieldset-legend">Suburb *</legend>
                <input
                  type="text"
                  class="input input-sm w-full"
                  required
                  value={formAddress.value.suburb}
                  onInput={(e) => updateForm("suburb", (e.target as HTMLInputElement).value)}
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">State *</legend>
                <input
                  type="text"
                  class="input input-sm w-full"
                  required
                  value={formAddress.value.state}
                  onInput={(e) => updateForm("state", (e.target as HTMLInputElement).value)}
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Postcode *</legend>
                <input
                  type="text"
                  class="input input-sm w-full"
                  required
                  value={formAddress.value.postcode}
                  onInput={(e) => updateForm("postcode", (e.target as HTMLInputElement).value)}
                />
              </fieldset>
            </div>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost btn-sm" onClick={closeAddressDialog}>
                Cancel
              </button>
              <button type="submit" class="btn btn-primary btn-sm" disabled={saving.value}>
                {saving.value ? <span class="loading loading-spinner loading-xs"></span> : "Save"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="submit" onClick={closeAddressDialog}>close</button>
        </form>
      </dialog>

      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Buyer</th>
              <th>Ordered</th>
              <th>Shipping Method</th>
              <th>Ship To</th>
              <th>Package Type</th>
              <th>L (cm)</th>
              <th>W (cm)</th>
              <th>H (cm)</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isCustom = selectedPackage.value[order.order_id] === "";
              const dims = dimensions.value[order.order_id];
              const addr = addresses.value[order.order_id];
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
                  <td>
                    <div class="flex items-start justify-between gap-2">
                      <div class="text-sm leading-snug">
                        <div class="font-medium">{addr.recipientName || "—"}</div>
                        {addr.addressLine1 && <div>{addr.addressLine1}</div>}
                        {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                        {(addr.suburb || addr.state || addr.postcode) && (
                          <div>{[addr.suburb, addr.state, addr.postcode].filter(Boolean).join(", ")}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs btn-square shrink-0"
                        title="Edit address"
                        onClick={() => openAddressDialog(order.order_id)}
                      >
                        <span class="iconify lucide--pencil size-3.5"></span>
                      </button>
                    </div>
                  </td>
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
    </div>
  );
}
