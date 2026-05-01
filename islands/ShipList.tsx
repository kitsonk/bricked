import { useRef } from "preact/hooks";
import { useComputed, useSignal } from "@preact/signals";
import type { AusPostAddress, BLOrder, PackageType } from "@/utils/types.ts";
import { formatAmount } from "@/utils/format.ts";

interface Dims {
  l: string;
  w: string;
  h: string;
}

const EMPTY_ADDRESS: AusPostAddress = {
  recipientName: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  suburb: "",
  state: "",
  postcode: "",
};

function isExportable(order: BLOrder, trackingMethodIds: Set<number>): boolean {
  if (order.shipping?.address?.country_code !== "AU") return false;
  if (!trackingMethodIds.has(order.shipping?.method_id)) return false;
  return true;
}

function packageLabel(pt: PackageType): string {
  const dims = `${pt.lengthCm.toFixed(1)} × ${pt.widthCm.toFixed(1)} × ${pt.heightCm.toFixed(1)} cm`;
  return `${pt.label} (${dims})`;
}

export default function ShipList(
  { orders, packageTypes, addresses: initialAddresses, trackingMethodIds }: {
    orders: BLOrder[];
    packageTypes: PackageType[];
    addresses: Record<number, AusPostAddress>;
    trackingMethodIds: number[];
  },
) {
  const trackingMethodSet = new Set(trackingMethodIds);
  const packageById = new Map(packageTypes.map((pt) => [pt.id, pt]));

  const selectedPackage = useSignal<Record<number, string>>(
    Object.fromEntries(orders.map((o) => [o.order_id, ""])),
  );

  const dimensions = useSignal<Record<number, Dims>>(
    Object.fromEntries(orders.map((o) => [o.order_id, { l: "", w: "", h: "" }])),
  );

  const weights = useSignal<Record<number, string>>(
    Object.fromEntries(orders.map((o) => [o.order_id, ""])),
  );

  const extraCover = useSignal<Record<number, string>>(
    Object.fromEntries(orders.map((o) => [o.order_id, "0"])),
  );

  const addresses = useSignal<Record<number, AusPostAddress>>(initialAddresses);
  const verifyStatuses = useSignal<Record<number, "verifying" | "success" | "unmatched" | "error">>({});
  const verifyingAll = useSignal(false);
  const editingOrderId = useSignal<number | null>(null);
  const editingCountryCode = useSignal<string>("");
  const formAddress = useSignal<AusPostAddress>(EMPTY_ADDRESS);
  const saving = useSignal(false);
  const verifying = useSignal(false);
  const verifyResult = useSignal<"success" | "unmatched" | null>(null);
  const addressError = useSignal<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedOrders = useSignal<Set<number>>(new Set());

  const hasSelection = useComputed(() => selectedOrders.value.size > 0);

  const allNonExportableSelected = useComputed(() => {
    const nonExportable = orders.filter((o) => !isExportable(o, trackingMethodSet));
    return nonExportable.length > 0 && nonExportable.every((o) => selectedOrders.value.has(o.order_id));
  });

  function toggleSelected(orderId: number) {
    const next = new Set(selectedOrders.value);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
    }
    selectedOrders.value = next;
  }

  function toggleSelectAll() {
    const nonExportable = orders.filter((o) => !isExportable(o, trackingMethodSet));
    const allSelected = nonExportable.every((o) => selectedOrders.value.has(o.order_id));
    const next = new Set(selectedOrders.value);
    if (allSelected) {
      for (const order of nonExportable) {
        next.delete(order.order_id);
      }
    } else {
      for (const order of nonExportable) {
        next.add(order.order_id);
      }
    }
    selectedOrders.value = next;
  }

  function printLabels() {
    const ids = Array.from(selectedOrders.value).join(",");
    const url = `/print-labels?orders=${encodeURIComponent(ids)}`;
    globalThis.open(url, "_blank");
  }

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
    const order = orders.find((o) => o.order_id === orderId);
    editingOrderId.value = orderId;
    editingCountryCode.value = order?.shipping?.address?.country_code ?? "";
    formAddress.value = { ...addresses.value[orderId] };
    addressError.value = null;
    verifyResult.value = null;
    dialogRef.current?.showModal();
  }

  function closeAddressDialog() {
    dialogRef.current?.close();
    editingOrderId.value = null;
  }

  function updateForm(field: keyof AusPostAddress, value: string) {
    formAddress.value = { ...formAddress.value, [field]: value };
    verifyResult.value = null;
  }

  async function verifyAddress() {
    verifying.value = true;
    addressError.value = null;
    verifyResult.value = null;
    try {
      const resp = await fetch("/api/ship-list/verify-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formAddress.value),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      if (!json.matched) {
        verifyResult.value = "unmatched";
      } else {
        formAddress.value = {
          ...formAddress.value,
          addressLine1: json.addressLine1,
          addressLine2: json.addressLine2 ?? "",
          addressLine3: json.addressLine3 ?? "",
          suburb: json.suburb,
          state: json.state,
          postcode: json.postcode,
        };
        verifyResult.value = "success";
      }
    } catch (err) {
      addressError.value = String(err);
    } finally {
      verifying.value = false;
    }
  }

  const exportReady = useComputed(() =>
    orders
      .filter((o) => isExportable(o, trackingMethodSet))
      .every((order) => {
        const dims = dimensions.value[order.order_id];
        const weight = weights.value[order.order_id];
        return dims.l && dims.w && dims.h && weight;
      })
  );

  async function exportManifest() {
    const rows = orders.filter((o) => isExportable(o, trackingMethodSet)).map((order) => ({
      orderId: order.order_id,
      countryCode: order.shipping?.address?.country_code ?? "",
      address: addresses.value[order.order_id],
      lengthCm: dimensions.value[order.order_id].l,
      widthCm: dimensions.value[order.order_id].w,
      heightCm: dimensions.value[order.order_id].h,
      weightKg: (parseFloat(weights.value[order.order_id]) / 1000).toString(),
      extraCover: extraCover.value[order.order_id],
    }));

    const resp = await fetch("/api/ship-list/manifest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    });

    if (!resp.ok) return;

    const disposition = resp.headers.get("Content-Disposition") ?? "";
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch ? filenameMatch[1] : "auspost-manifest.csv";

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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

  async function verifyAllAddresses() {
    verifyingAll.value = true;
    const exportableOrders = orders.filter((o) => isExportable(o, trackingMethodSet));
    verifyStatuses.value = Object.fromEntries(exportableOrders.map((o) => [o.order_id, "verifying" as const]));

    await Promise.all(
      exportableOrders.map(async (order) => {
        const addr = addresses.value[order.order_id];
        try {
          const resp = await fetch("/api/ship-list/verify-address", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(addr),
          });
          const json = await resp.json();
          if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
          if (!json.matched) {
            verifyStatuses.value = { ...verifyStatuses.value, [order.order_id]: "unmatched" };
          } else {
            const updatedAddr: AusPostAddress = {
              ...addr,
              addressLine1: json.addressLine1,
              addressLine2: json.addressLine2 ?? "",
              addressLine3: json.addressLine3 ?? "",
              suburb: json.suburb,
              state: json.state,
              postcode: json.postcode,
            };
            const saveResp = await fetch(`/api/ship-list/${order.order_id}/address`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updatedAddr),
            });
            if (!saveResp.ok) throw new Error(`HTTP ${saveResp.status}`);
            addresses.value = { ...addresses.value, [order.order_id]: updatedAddr };
            verifyStatuses.value = { ...verifyStatuses.value, [order.order_id]: "success" };
          }
        } catch {
          verifyStatuses.value = { ...verifyStatuses.value, [order.order_id]: "error" };
        }
      }),
    );

    verifyingAll.value = false;
  }

  return (
    <div>
      <div class="flex justify-end mb-4 gap-2">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          disabled={!hasSelection.value}
          onClick={printLabels}
        >
          <span class="iconify lucide--printer size-4"></span>
          Print Labels
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          disabled={!exportReady.value}
          title={!exportReady.value
            ? "All exportable rows must have length, width, height and weight filled in"
            : undefined}
          onClick={exportManifest}
        >
          <span class="iconify lucide--download size-4"></span>
          Export Manifest
        </button>
      </div>
      <dialog ref={dialogRef} class="modal">
        <div class="modal-box max-w-md">
          <h3 class="text-lg font-bold mb-4">Edit Recipient Address</h3>
          {addressError.value && (
            <div role="alert" class="alert alert-error mb-4 text-sm">
              <span class="iconify lucide--alert-circle size-4"></span>
              <span>{addressError.value}</span>
            </div>
          )}
          {verifyResult.value === "success" && (
            <div role="alert" class="alert alert-success mb-4 text-sm">
              <span class="iconify lucide--circle-check size-4"></span>
              <span>Address verified and updated.</span>
            </div>
          )}
          {verifyResult.value === "unmatched" && (
            <div role="alert" class="alert alert-warning mb-4 text-sm">
              <span class="iconify lucide--alert-triangle size-4"></span>
              <span>Address could not be verified — please check and correct manually.</span>
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
                onInput={(e) => updateForm("recipientName", e.currentTarget.value)}
              />
            </fieldset>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Address line 1 *</legend>
              <input
                type="text"
                class="input input-sm w-full"
                required
                value={formAddress.value.addressLine1}
                onInput={(e) => updateForm("addressLine1", e.currentTarget.value)}
              />
            </fieldset>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Address line 2</legend>
              <input
                type="text"
                class="input input-sm w-full"
                value={formAddress.value.addressLine2}
                onInput={(e) => updateForm("addressLine2", e.currentTarget.value)}
              />
            </fieldset>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Address line 3</legend>
              <input
                type="text"
                class="input input-sm w-full"
                value={formAddress.value.addressLine3}
                onInput={(e) => updateForm("addressLine3", e.currentTarget.value)}
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
                  onInput={(e) => updateForm("suburb", e.currentTarget.value)}
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">State *</legend>
                <input
                  type="text"
                  class="input input-sm w-full"
                  required
                  value={formAddress.value.state}
                  onInput={(e) => updateForm("state", e.currentTarget.value)}
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Postcode *</legend>
                <input
                  type="text"
                  class="input input-sm w-full"
                  required
                  value={formAddress.value.postcode}
                  onInput={(e) => updateForm("postcode", e.currentTarget.value)}
                />
              </fieldset>
            </div>
            <div class="modal-action">
              {editingCountryCode.value === "AU" && (
                <button
                  type="button"
                  class="btn btn-primary btn-sm mr-auto"
                  disabled={verifying.value || saving.value}
                  onClick={verifyAddress}
                >
                  {verifying.value
                    ? (
                      <>
                        <span class="loading loading-spinner loading-xs"></span>
                        Verifying
                      </>
                    )
                    : "Verify"}
                </button>
              )}
              <button type="button" class="btn btn-ghost btn-sm" onClick={closeAddressDialog}>
                Cancel
              </button>
              <button type="submit" class="btn btn-primary btn-sm" disabled={saving.value || verifying.value}>
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
              <th class="w-10">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  checked={allNonExportableSelected.value}
                  onChange={toggleSelectAll}
                  aria-label="Select all non-exportable orders"
                />
              </th>
              <th>Order Info</th>
              <th>Shipping Method</th>
              <th>
                <div class="flex items-center gap-1">
                  Ship To
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs btn-square"
                    title="Verify all exportable addresses"
                    disabled={verifyingAll.value}
                    onClick={verifyAllAddresses}
                  >
                    {verifyingAll.value
                      ? <span class="loading loading-spinner loading-xs"></span>
                      : <span class="iconify lucide--wand-sparkles size-3.5"></span>}
                  </button>
                </div>
              </th>
              <th>Package Type</th>
              <th>Dimensions</th>
              <th>Weight (g)</th>
              <th>Extra Cover ($)</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isCustom = selectedPackage.value[order.order_id] === "";
              const dims = dimensions.value[order.order_id];
              const addr = addresses.value[order.order_id];
              const exportable = isExportable(order, trackingMethodSet);
              return (
                <tr key={order.order_id} class={!exportable ? "bg-neutral/10" : ""}>
                  <td class="w-10">
                    {!exportable && (
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        checked={selectedOrders.value.has(order.order_id)}
                        onChange={() => toggleSelected(order.order_id)}
                        aria-label={`Select order #${order.order_id}`}
                      />
                    )}
                  </td>
                  <td class="text-sm leading-snug">
                    <div>
                      <a class="link font-mono font-medium" href={`/orders/${order.order_id}`}>
                        #{order.order_id}
                      </a>
                    </div>
                    <div class="text-base-content/60">
                      {order.total_count} ({order.unique_count} lots)
                    </div>
                    <div class="font-medium">
                      {order.disp_cost.currency_code} {formatAmount(order.disp_cost.grand_total)}
                    </div>
                  </td>
                  <td class="text-sm">{order.shipping?.method || "—"}</td>
                  <td>
                    <div class="flex items-start justify-between gap-2">
                      <div class="text-sm leading-snug">
                        <div class="font-medium">{addr.recipientName || "—"}</div>
                        {addr.addressLine1 && <div>{addr.addressLine1}</div>}
                        {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                        {addr.addressLine3 && <div>{addr.addressLine3}</div>}
                        {(addr.suburb || addr.state || addr.postcode) && (
                          <div>{[addr.suburb, addr.state, addr.postcode].filter(Boolean).join(", ")}</div>
                        )}
                        {verifyStatuses.value[order.order_id] === "verifying" && (
                          <div class="mt-1">
                            <span class="loading loading-spinner loading-xs"></span>
                          </div>
                        )}
                        {verifyStatuses.value[order.order_id] === "success" && (
                          <div class="text-success text-xs mt-1 flex items-center gap-1">
                            <span class="iconify lucide--circle-check size-3.5"></span>
                            Verified
                          </div>
                        )}
                        {verifyStatuses.value[order.order_id] === "unmatched" && (
                          <div class="text-warning text-xs mt-1 flex items-center gap-1">
                            <span class="iconify lucide--alert-triangle size-3.5"></span>
                            Unmatched
                          </div>
                        )}
                        {verifyStatuses.value[order.order_id] === "error" && (
                          <div class="text-error text-xs mt-1 flex items-center gap-1">
                            <span class="iconify lucide--alert-circle size-3.5"></span>
                            Error
                          </div>
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
                  {exportable
                    ? (
                      <>
                        <td>
                          <select
                            class="select select-sm w-full min-w-40"
                            value={selectedPackage.value[order.order_id]}
                            onChange={(e) => setPackage(order.order_id, e.currentTarget.value)}
                          >
                            <option value="">Custom</option>
                            {packageTypes.map((pt) => <option key={pt.id} value={pt.id}>{packageLabel(pt)}</option>)}
                          </select>
                        </td>
                        <td>
                          <div class="space-y-1">
                            <div class="flex items-center gap-2">
                              <span class="text-xs text-base-content/50 w-10">L (cm)</span>
                              <input
                                type="number"
                                class="input input-sm w-24"
                                step="0.1"
                                min="0"
                                disabled={!isCustom}
                                value={dims.l}
                                onInput={(e) => setDim(order.order_id, "l", e.currentTarget.value)}
                              />
                            </div>
                            <div class="flex items-center gap-2">
                              <span class="text-xs text-base-content/50 w-10">W (cm)</span>
                              <input
                                type="number"
                                class="input input-sm w-24"
                                step="0.1"
                                min="0"
                                disabled={!isCustom}
                                value={dims.w}
                                onInput={(e) => setDim(order.order_id, "w", e.currentTarget.value)}
                              />
                            </div>
                            <div class="flex items-center gap-2">
                              <span class="text-xs text-base-content/50 w-10">H (cm)</span>
                              <input
                                type="number"
                                class="input input-sm w-24"
                                step="0.1"
                                min="0"
                                disabled={!isCustom}
                                value={dims.h}
                                onInput={(e) => setDim(order.order_id, "h", e.currentTarget.value)}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            class="input input-sm w-24"
                            step="1"
                            min="0"
                            value={weights.value[order.order_id]}
                            onInput={(e) =>
                              weights.value = {
                                ...weights.value,
                                [order.order_id]: e.currentTarget.value,
                              }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            class="input input-sm w-24"
                            step="100"
                            min="0"
                            value={extraCover.value[order.order_id]}
                            onInput={(e) =>
                              extraCover.value = {
                                ...extraCover.value,
                                [order.order_id]: e.currentTarget.value,
                              }}
                          />
                        </td>
                      </>
                    )
                    : <td colSpan={4} />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
