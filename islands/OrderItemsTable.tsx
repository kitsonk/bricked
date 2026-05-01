import { useSignal } from "@preact/signals";
import type { BLOrderItem } from "@/utils/types.ts";
import { ConditionBadge } from "@/components/ConditionBadge.tsx";
import { bricklinkCatalogUrl, bricklinkItemImageUrl, formatAmount } from "@/utils/format.ts";
import { decodeHtml } from "@/utils/html.ts";
import { type PartDialogItem, PartImageDialog } from "@/components/PartImageDialog.tsx";

interface Props {
  orderId: number;
  items: BLOrderItem[];
  currencyCode: string;
}

export default function OrderItemsTable({ orderId, items, currencyCode }: Props) {
  const dialogItem = useSignal<PartDialogItem | null>(null);

  return (
    <>
      <div class="flex justify-end p-4">
        <a href={`/pick-list?orders=${orderId}`} class="btn btn-primary btn-sm">
          <span class="iconify lucide--package size-4"></span>
          Pick List for This Order
        </a>
      </div>
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>Item</th>
              <th>Color</th>
              <th>Cond.</th>
              <th class="text-right">Qty</th>
              <th>Location</th>
              <th class="text-right">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.order_item_no}>
                <td>
                  <div class="flex items-center gap-3">
                    <button
                      type="button"
                      class="shrink-0 cursor-zoom-in"
                      onClick={() => {
                        dialogItem.value = {
                          itemNo: item.item.no,
                          itemName: decodeHtml(item.item.name),
                          itemType: item.item.type,
                          colorId: item.color_id,
                          colorName: item.color_name,
                          description: item.description || undefined,
                        };
                      }}
                      aria-label={`View image for ${decodeHtml(item.item.name)}`}
                    >
                      <img
                        src={bricklinkItemImageUrl(item.item.type, item.item.no, item.color_id)}
                        alt={decodeHtml(item.item.name)}
                        class="size-10 object-contain"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.parentElement!.style.display = "none";
                        }}
                      />
                    </button>
                    <div>
                      <a
                        href={bricklinkCatalogUrl(item.item.type, item.item.no)}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="font-medium link link-hover"
                      >
                        {decodeHtml(item.item.name)}
                      </a>
                      <div class="text-xs text-base-content/50 font-mono">{item.item.no}</div>
                      {item.description && (
                        <div class="text-xs text-base-content/50 whitespace-normal">{item.description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td class="text-sm">{item.color_name}</td>
                <td>
                  <ConditionBadge condition={item.new_or_used} />
                </td>
                <td class="text-right font-bold">{item.quantity}</td>
                <td>
                  {item.remarks
                    ? <span class="font-mono text-sm text-primary">{item.remarks}</span>
                    : <span class="text-base-content/30 text-xs">—</span>}
                </td>
                <td class="text-right text-sm font-mono">
                  {currencyCode} {formatAmount(item.disp_unit_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PartImageDialog item={dialogItem.value} onClose={() => (dialogItem.value = null)} />
    </>
  );
}
