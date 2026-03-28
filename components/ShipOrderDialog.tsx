import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { BLOrder } from "@/utils/types.ts";

export interface ShipFormData {
  dateShipped: string;
  trackingNo: string;
  trackingLink: string;
}

interface Props {
  order: BLOrder | null;
  hasTracking: boolean;
  isOpen: boolean;
  onConfirm: (data: ShipFormData) => void;
  onClose: () => void;
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function ShipOrderDialog({ order, hasTracking, isOpen, onConfirm, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dateShipped = useSignal(todayDate());
  const trackingNo = useSignal("");
  const trackingLink = useSignal("");

  useEffect(() => {
    if (isOpen) {
      dateShipped.value = todayDate();
      trackingNo.value = "";
      trackingLink.value = "";
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  if (!order) return null;

  const addr = order.shipping?.address;
  const addressLines = addr
    ? [
      addr.name?.full || [addr.name?.first, addr.name?.last].filter(Boolean).join(" "),
      addr.address1,
      addr.address2,
      [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
      addr.country_code,
    ].filter(Boolean)
    : [];

  return (
    <dialog ref={dialogRef} class="modal">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">Ship Order #{order.order_id}</h3>

        <div class="grid grid-cols-2 gap-4 mb-5 text-sm">
          <div>
            <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Ship To</div>
            {addressLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <div>
            <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Method</div>
            <div>{order.shipping?.method || "—"}</div>
          </div>
        </div>

        <fieldset class="fieldset mb-3">
          <legend class="fieldset-legend">Ship Date</legend>
          <input
            type="date"
            class="input w-full"
            value={dateShipped.value}
            onInput={(e) => (dateShipped.value = (e.target as HTMLInputElement).value)}
          />
        </fieldset>

        {hasTracking && (
          <>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Tracking Number</legend>
              <input
                type="text"
                class="input w-full"
                placeholder="Enter tracking number"
                value={trackingNo.value}
                onInput={(e) => (trackingNo.value = (e.target as HTMLInputElement).value)}
              />
            </fieldset>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Tracking URL</legend>
              <input
                type="url"
                class="input w-full"
                placeholder="https://..."
                value={trackingLink.value}
                onInput={(e) => (trackingLink.value = (e.target as HTMLInputElement).value)}
              />
            </fieldset>
          </>
        )}

        <div class="modal-action">
          <button type="button" class="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            class="btn btn-info"
            disabled={!dateShipped.value}
            onClick={() =>
              onConfirm({
                dateShipped: dateShipped.value,
                trackingNo: trackingNo.value,
                trackingLink: trackingLink.value,
              })}
          >
            Ship Order
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit" onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
