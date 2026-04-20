import { useSignal } from "@preact/signals";

type ItemType = "S" | "P" | "M" | "B" | "G" | "C" | "I" | "O";
type Condition = "N" | "U";

type PendingItem = {
  id: string;
  ITEMTYPE: ItemType;
  ITEMID: string;
  PRICE: number;
  QTY: number;
  CONDITION: Condition;
  DESCRIPTION: string;
  REMARKS: string;
};

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: "S", label: "Set" },
  { value: "P", label: "Part" },
  { value: "M", label: "Minifigure" },
  { value: "B", label: "Book" },
  { value: "G", label: "Gear" },
  { value: "C", label: "Catalog" },
  { value: "I", label: "Instruction Manual" },
  { value: "O", label: "Original Box" },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(ITEM_TYPES.map((t) => [t.value, t.label]));

export default function Inventory() {
  const itemType = useSignal<ItemType>("S");
  const itemId = useSignal("");
  const price = useSignal("");
  const qty = useSignal("");
  const condition = useSignal<Condition>("N");
  const description = useSignal("");
  const remarks = useSignal("");

  const pending = useSignal<PendingItem[]>([]);
  const copying = useSignal(false);
  const copyError = useSignal<string | null>(null);

  function addItem(e: Event) {
    e.preventDefault();
    pending.value = [
      ...pending.value,
      {
        id: crypto.randomUUID(),
        ITEMTYPE: itemType.value,
        ITEMID: itemId.value.trim(),
        PRICE: parseFloat(parseFloat(price.value).toFixed(2)),
        QTY: parseInt(qty.value, 10),
        CONDITION: condition.value,
        DESCRIPTION: description.value.trim(),
        REMARKS: remarks.value.trim(),
      },
    ];
    itemId.value = "";
    price.value = "";
    qty.value = "";
    description.value = "";
    remarks.value = "";
  }

  function removeItem(id: string) {
    pending.value = pending.value.filter((i) => i.id !== id);
  }

  async function copyXml() {
    copying.value = true;
    copyError.value = null;
    try {
      const payload = {
        INVENTORY: {
          ITEM: pending.value.map(({ id: _id, ...item }) => item),
        },
      };
      const resp = await fetch("/api/xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await navigator.clipboard.writeText(await resp.text());
    } catch (err) {
      copyError.value = String(err);
    } finally {
      copying.value = false;
    }
  }

  return (
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
      <div class="space-y-8">
        <section>
          <h2 class="text-lg font-semibold mb-4">Add Item</h2>
          <div class="border border-base-content/10 rounded-box p-4">
            <form onSubmit={addItem}>
              <div class="grid grid-cols-2 gap-3 mb-3">
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">Item Type</legend>
                  <select
                    class="select w-full"
                    required
                    value={itemType.value}
                    onChange={(e) => (itemType.value = e.currentTarget.value as ItemType)}
                  >
                    {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </fieldset>
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">Item ID</legend>
                  <input
                    type="text"
                    class="input w-full"
                    placeholder="e.g. 10255"
                    required
                    value={itemId.value}
                    onInput={(e) => (itemId.value = e.currentTarget.value)}
                  />
                </fieldset>
              </div>
              <div class="grid grid-cols-3 gap-3 mb-3">
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">Price</legend>
                  <input
                    type="number"
                    class="input w-full"
                    placeholder="0.00"
                    required
                    min="0"
                    step="0.01"
                    value={price.value}
                    onInput={(e) => (price.value = e.currentTarget.value)}
                  />
                </fieldset>
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">Qty</legend>
                  <input
                    type="number"
                    class="input w-full"
                    placeholder="1"
                    required
                    min="1"
                    step="1"
                    value={qty.value}
                    onInput={(e) => (qty.value = e.currentTarget.value)}
                  />
                </fieldset>
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">Condition</legend>
                  <select
                    class="select w-full"
                    required
                    value={condition.value}
                    onChange={(e) => (condition.value = e.currentTarget.value as Condition)}
                  >
                    <option value="N">New</option>
                    <option value="U">Used</option>
                  </select>
                </fieldset>
              </div>
              <fieldset class="fieldset mb-3">
                <legend class="fieldset-legend">Description</legend>
                <input
                  type="text"
                  class="input w-full"
                  placeholder="Optional"
                  maxLength={255}
                  value={description.value}
                  onInput={(e) => (description.value = e.currentTarget.value)}
                />
              </fieldset>
              <fieldset class="fieldset mb-4">
                <legend class="fieldset-legend">Remarks</legend>
                <input
                  type="text"
                  class="input w-full"
                  placeholder="Optional"
                  value={remarks.value}
                  onInput={(e) => (remarks.value = e.currentTarget.value)}
                />
              </fieldset>
              <div class="flex justify-end">
                <button type="submit" class="btn btn-primary btn-sm">
                  <span class="iconify lucide--plus size-4"></span>
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </section>

        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">
              Pending Items
              {pending.value.length > 0 &&
                <span class="badge badge-neutral badge-sm ml-2">{pending.value.length}</span>}
            </h2>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn btn-sm btn-outline"
                disabled={pending.value.length === 0 || copying.value}
                onClick={copyXml}
              >
                {copying.value
                  ? <span class="loading loading-spinner loading-xs"></span>
                  : <span class="iconify lucide--clipboard size-4"></span>}
                Copy XML
              </button>
              <button
                type="button"
                class="btn btn-sm btn-ghost text-error"
                disabled={pending.value.length === 0}
                onClick={() => {
                  pending.value = [];
                  copyError.value = null;
                }}
              >
                <span class="iconify lucide--rotate-ccw size-4"></span>
                Reset
              </button>
            </div>
          </div>
          {copyError.value && (
            <div role="alert" class="alert alert-error mb-4">
              <span class="iconify lucide--alert-circle size-5"></span>
              <div>{copyError.value}</div>
            </div>
          )}
          {pending.value.length === 0
            ? (
              <div class="flex flex-col items-center py-10 text-base-content/50 border border-base-content/10 rounded-box">
                <span class="iconify lucide--inbox size-10 mb-2"></span>
                <p class="text-sm">No pending items. Add items above.</p>
              </div>
            )
            : (
              <div class="overflow-x-auto rounded-box border border-base-content/10">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Item ID</th>
                      <th class="text-right">Price</th>
                      <th class="text-right">Qty</th>
                      <th>Condition</th>
                      <th>Description</th>
                      <th>Remarks</th>
                      <th class="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.value.map((item) => (
                      <tr key={item.id}>
                        <td>{TYPE_LABELS[item.ITEMTYPE]}</td>
                        <td class="font-mono">{item.ITEMID}</td>
                        <td class="text-right font-mono">{item.PRICE.toFixed(2)}</td>
                        <td class="text-right font-mono">{item.QTY}</td>
                        <td>{item.CONDITION === "N" ? "New" : "Used"}</td>
                        <td class="text-base-content/70 text-sm max-w-48 truncate">{item.DESCRIPTION || "—"}</td>
                        <td class="text-base-content/70 text-sm max-w-48 truncate">{item.REMARKS || "—"}</td>
                        <td>
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs btn-square text-error"
                            title="Remove"
                            onClick={() => removeItem(item.id)}
                          >
                            <span class="iconify lucide--trash-2 size-3.5"></span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </div>

      <div class="space-y-8">
        <section>
          <h2 class="text-lg font-semibold mb-4">Store Items</h2>
          <div class="flex flex-col items-center py-10 text-base-content/50 border border-base-content/10 rounded-box">
            <span class="iconify lucide--store size-10 mb-2"></span>
            <p class="text-sm">Store items matching the item ID will appear here.</p>
          </div>
        </section>

        <section>
          <h2 class="text-lg font-semibold mb-4">Marketplace Items</h2>
          <div class="flex flex-col items-center py-10 text-base-content/50 border border-base-content/10 rounded-box">
            <span class="iconify lucide--shopping-cart size-10 mb-2"></span>
            <p class="text-sm">Marketplace items matching the item ID will appear here.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
