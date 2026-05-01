import { useEffect, useRef } from "preact/hooks";
import { bricklinkCatalogUrl, bricklinkItemImageUrl } from "@/utils/format.ts";

export interface PartDialogItem {
  itemNo: string;
  itemName: string;
  itemType: string;
  colorId: number;
  colorName: string;
  description?: string;
}

interface Props {
  item: PartDialogItem | null;
  onClose: () => void;
}

export function PartImageDialog({ item, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (item) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [item]);

  const catalogUrl = item ? bricklinkCatalogUrl(item.itemType, item.itemNo) : "#";

  return (
    <dialog ref={dialogRef} class="modal">
      <div class="modal-box max-w-sm">
        {item && (
          <>
            <div class="flex justify-end mb-2">
              <button type="button" class="btn btn-ghost btn-sm btn-circle" onClick={onClose} aria-label="Close">
                <span class="iconify lucide--x size-4"></span>
              </button>
            </div>
            <div class="flex justify-center mb-4 bg-base-200 rounded-box p-4">
              <img
                src={bricklinkItemImageUrl(item.itemType, item.itemNo, item.colorId)}
                alt={item.itemName}
                class="max-h-48 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div class="space-y-1 text-sm mb-4">
              <div class="flex gap-2">
                <span class="text-base-content/50 w-20 shrink-0">Part No.</span>
                <span class="font-mono">{item.itemNo}</span>
              </div>
              <div class="flex gap-2">
                <span class="text-base-content/50 w-20 shrink-0">Name</span>
                <span>{item.itemName}</span>
              </div>
              {item.description && (
                <div class="flex gap-2">
                  <span class="text-base-content/50 w-20 shrink-0">Description</span>
                  <span class="text-base-content/70">{item.description}</span>
                </div>
              )}
              <div class="flex gap-2">
                <span class="text-base-content/50 w-20 shrink-0">Color</span>
                <span>{item.colorName}</span>
              </div>
            </div>
            <div class="modal-action">
              <a
                href={catalogUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-primary btn-sm"
              >
                Catalog Entry
                <span class="iconify lucide--external-link size-4"></span>
              </a>
              <button type="button" class="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit" onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
