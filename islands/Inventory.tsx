import { useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";
import { ConditionBadge } from "@/components/ConditionBadge.tsx";

type ItemType = "S" | "P" | "M" | "B" | "G" | "C" | "I" | "O";
type Condition = "N" | "U";

type PendingItem = {
  id: string;
  ITEMTYPE: ItemType;
  ITEMID: string;
  COLOR?: number;
  COLOR_NAME?: string; // display only — stripped before XML
  PRICE: number;
  QTY: number;
  CONDITION: Condition;
  DESCRIPTION: string;
  REMARKS: string;
};

type MarketplaceItem = {
  strStorename: string;
  n4SellerFeedbackScore: number;
  n4Qty: number;
  mInvSalePrice: string;
  codeNew: string;
  strDesc: string;
};

type ItemColor = {
  color_id: number;
  color_name: string;
};

type CatalogItem = {
  name: string;
  image_url: string;
  year_released: number;
  is_obsolete: boolean;
};

type StoreItem = {
  invQty: number;
  nativePrice: string;
  invNew: string;
  invDescription: string;
};

function formatPrice(raw: string): string {
  return raw.startsWith("AU ") ? raw.slice(3) : raw;
}

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
  const qty = useSignal("1");
  const condition = useSignal<Condition>("U");
  const description = useSignal("");
  const remarks = useSignal("");

  const pending = useSignal<PendingItem[]>([]);
  const copying = useSignal(false);
  const copyError = useSignal<string | null>(null);

  const marketplaceItems = useSignal<MarketplaceItem[] | null>(null);
  const marketplaceLoading = useSignal(false);
  const storeLoading = useSignal(false);
  const marketplaceError = useSignal<string | null>(null);
  const marketplacePage = useSignal(1);
  const marketplaceTotalCount = useSignal<number | null>(null);
  const itemColors = useSignal<ItemColor[]>([]);
  const selectedColorId = useSignal<number | null>(null); // null = All
  const catalogItem = useSignal<CatalogItem | null>(null);
  const colorImageUrl = useSignal<string | null>(null); // overrides catalogItem.image_url for a specific color
  const partCount = useSignal<number | null>(null);
  const storeItems = useSignal<StoreItem[] | null>(null);
  const storeItemId = useSignal<number | null>(null);
  const imageDialogRef = useRef<HTMLDialogElement>(null);

  // Color select is only useful when the item has more than one real color.
  // A single color with ID 0 means the item is colorless.
  function isColorSelectEnabled(): boolean {
    const colors = itemColors.value;
    if (colors.length === 0) return false;
    if (colors.length === 1 && colors[0].color_id === 0) return false;
    return true;
  }

  function addItem(e: Event) {
    e.preventDefault();
    const colorId = selectedColorId.value;
    const hasColor = colorId !== null && colorId !== 0;
    pending.value = [
      ...pending.value,
      {
        id: crypto.randomUUID(),
        ITEMTYPE: itemType.value,
        ITEMID: itemId.value.trim(),
        ...(hasColor && {
          COLOR: colorId,
          COLOR_NAME: itemColors.value.find((c) => c.color_id === colorId)?.color_name,
        }),
        PRICE: parseFloat(parseFloat(price.value).toFixed(2)),
        QTY: parseInt(qty.value, 10),
        CONDITION: condition.value,
        DESCRIPTION: description.value.trim(),
        REMARKS: remarks.value.trim(),
      },
    ];
    itemId.value = "";
    price.value = "";
    qty.value = "1";
    description.value = "";
    remarks.value = "";
    itemColors.value = [];
    selectedColorId.value = null;
    marketplaceItems.value = null;
    catalogItem.value = null;
    colorImageUrl.value = null;
    partCount.value = null;
    storeItems.value = null;
    storeItemId.value = null;
    marketplacePage.value = 1;
    marketplaceTotalCount.value = null;
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
          ITEM: pending.value.map(({ id: _id, COLOR_NAME: _cn, ...item }) => item),
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

  // Initial item lookup — fetches marketplace listings and item colors together.
  async function fetchMarketplace() {
    const id = itemId.value.trim();
    if (!id) return;
    marketplaceLoading.value = true;
    storeLoading.value = true;
    marketplaceError.value = null;
    marketplaceItems.value = null;
    itemColors.value = [];
    selectedColorId.value = null;
    catalogItem.value = null;
    colorImageUrl.value = null;
    partCount.value = null;
    storeItems.value = null;
    storeItemId.value = null;
    marketplacePage.value = 1;
    marketplaceTotalCount.value = null;
    try {
      const url = `/api/marketplace?itemid=${encodeURIComponent(id)}&itemtype=${
        encodeURIComponent(itemType.value)
      }&page=1`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      marketplaceItems.value = json.list ?? [];
      marketplaceTotalCount.value = json.total_count ?? null;
      itemColors.value = json.colors ?? [];
      catalogItem.value = json.catalogItem ?? null;
      partCount.value = json.partCount ?? null;
      storeItems.value = json.storeItems ?? [];
      storeItemId.value = json.idItem ?? null;
    } catch (err) {
      marketplaceError.value = String(err);
    } finally {
      marketplaceLoading.value = false;
      storeLoading.value = false;
    }
  }

  // Re-fetches marketplace listings for a specific color. Skips the color/catalog lookup.
  async function refreshMarketplace(colorId: number | null) {
    const id = itemId.value.trim();
    if (!id) return;
    marketplaceLoading.value = true;
    storeLoading.value = true;
    marketplaceError.value = null;
    marketplaceItems.value = null;
    storeItems.value = null;
    marketplacePage.value = 1;
    marketplaceTotalCount.value = null;
    // Selecting "All" restores the original catalog image immediately.
    if (colorId === null) colorImageUrl.value = null;
    try {
      const colorParam = colorId !== null ? String(colorId) : "all";
      const url = `/api/marketplace?itemid=${encodeURIComponent(id)}&itemtype=${
        encodeURIComponent(itemType.value)
      }&colorid=${colorParam}&page=1`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      marketplaceItems.value = json.list ?? [];
      marketplaceTotalCount.value = json.total_count ?? null;
      storeItems.value = json.storeItems ?? [];
      if (json.imageUrl) colorImageUrl.value = json.imageUrl;
    } catch (err) {
      marketplaceError.value = String(err);
    } finally {
      marketplaceLoading.value = false;
      storeLoading.value = false;
    }
  }

  async function fetchMarketplacePage(page: number) {
    const id = itemId.value.trim();
    if (!id) return;
    marketplaceLoading.value = true;
    marketplaceError.value = null;
    try {
      const colorParam = selectedColorId.value !== null ? `&colorid=${selectedColorId.value}` : "&colorid=all";
      const url = `/api/marketplace?itemid=${encodeURIComponent(id)}&itemtype=${
        encodeURIComponent(itemType.value)
      }${colorParam}&page=${page}&list_only=true`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      marketplaceItems.value = json.list ?? [];
      marketplaceTotalCount.value = json.total_count ?? null;
      marketplacePage.value = page;
    } catch (err) {
      marketplaceError.value = String(err);
    } finally {
      marketplaceLoading.value = false;
    }
  }

  return (
    <>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        <div class="space-y-8">
          <section>
            <h2 class="text-lg font-semibold mb-4">Add Item</h2>
            <div class="border border-base-content/10 rounded-box p-4">
              <form onSubmit={addItem}>
                <div class="grid grid-cols-3 gap-3 mb-3">
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
                    <div class="join w-full">
                      <input
                        type="text"
                        class="input join-item w-full"
                        placeholder="e.g. 10255"
                        required
                        value={itemId.value}
                        onInput={(e) => (itemId.value = e.currentTarget.value)}
                      />
                      <button
                        type="button"
                        class="btn btn-primary join-item"
                        title="Look up item"
                        disabled={marketplaceLoading.value || !itemId.value.trim()}
                        onClick={fetchMarketplace}
                      >
                        {marketplaceLoading.value
                          ? <span class="loading loading-spinner loading-xs"></span>
                          : <span class="iconify lucide--search size-4"></span>}
                      </button>
                    </div>
                  </fieldset>
                  <fieldset class="fieldset">
                    <legend class="fieldset-legend">Color</legend>
                    <select
                      class="select w-full"
                      disabled={!isColorSelectEnabled()}
                      value={selectedColorId.value === null ? "all" : String(selectedColorId.value)}
                      onChange={(e) => {
                        const val = e.currentTarget.value;
                        const colorId = val === "all" ? null : parseInt(val, 10);
                        selectedColorId.value = colorId;
                        refreshMarketplace(colorId);
                      }}
                    >
                      <option value="all">All</option>
                      {itemColors.value
                        .filter((c) => c.color_id !== 0)
                        .map((c) => <option key={c.color_id} value={String(c.color_id)}>{c.color_name}</option>)}
                    </select>
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
                  class="btn btn-sm btn-primary"
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
                  class="btn btn-sm btn-secondary"
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
                        <th>Color</th>
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
                          <td class="text-sm">
                            {item.COLOR_NAME ?? (item.COLOR !== undefined ? String(item.COLOR) : "—")}
                          </td>
                          <td class="text-right font-mono">{item.PRICE.toFixed(2)}</td>
                          <td class="text-right font-mono">{item.QTY}</td>
                          <td>{item.CONDITION === "N" ? "New" : "Used"}</td>
                          <td class="text-base-content/70 text-sm max-w-48 truncate">{item.DESCRIPTION || "—"}</td>
                          <td class="text-base-content/70 text-sm max-w-48 truncate">{item.REMARKS || "—"}</td>
                          <td>
                            <button
                              type="button"
                              class="btn btn-ghost btn-xs btn-square text-secondary"
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
            <h2 class="text-lg font-semibold mb-4">Item Overview</h2>
            {catalogItem.value
              ? (
                <div class="border border-base-content/10 rounded-box p-4 flex gap-4 items-start">
                  <button
                    type="button"
                    class="relative group cursor-zoom-in shrink-0"
                    onClick={() => imageDialogRef.current?.showModal()}
                    aria-label="View full image"
                  >
                    <img
                      src={`https:${colorImageUrl.value ?? catalogItem.value.image_url}`}
                      alt={catalogItem.value.name}
                      class="w-24 h-24 object-contain rounded-box bg-base-200"
                    />
                    <div class="absolute inset-0 rounded-box bg-base-content/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span class="iconify lucide--zoom-in size-6 text-base-100"></span>
                    </div>
                  </button>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start gap-2 mb-1">
                      <h3 class="font-semibold text-base">{catalogItem.value.name}</h3>
                      {catalogItem.value.is_obsolete && (
                        <span class="badge badge-warning badge-sm shrink-0 mt-0.5">Obsolete</span>
                      )}
                    </div>
                    <p class="text-sm text-base-content/70">{catalogItem.value.year_released}</p>
                    {partCount.value !== null && <p class="text-sm text-base-content/70">{partCount.value} parts</p>}
                  </div>
                </div>
              )
              : (
                <div class="flex flex-col items-center py-10 text-base-content/50 border border-base-content/10 rounded-box">
                  <span class="iconify lucide--package size-10 mb-2"></span>
                  <p class="text-sm">Item details will appear here after a lookup.</p>
                </div>
              )}
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-4">Store Items</h2>
            {storeLoading.value
              ? (
                <div class="flex justify-center py-10">
                  <span class="loading loading-spinner loading-md"></span>
                </div>
              )
              : storeItems.value === null
              ? (
                <div class="flex flex-col items-center py-10 text-base-content/50 border border-base-content/10 rounded-box">
                  <span class="iconify lucide--store size-10 mb-2"></span>
                  <p class="text-sm">Store items matching the item ID will appear here.</p>
                </div>
              )
              : storeItems.value.length === 0
              ? (
                <div class="flex flex-col items-center py-10 text-base-content/50 border border-base-content/10 rounded-box">
                  <span class="iconify lucide--store size-10 mb-2"></span>
                  <p class="text-sm">No store listings found for this item.</p>
                </div>
              )
              : (
                <div class="overflow-x-auto overflow-y-auto max-h-96 rounded-box border border-base-content/10">
                  <table class="table table-sm">
                    <thead class="sticky top-0 bg-base-100">
                      <tr>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Price</th>
                        <th>Condition</th>
                        <th>Description</th>
                        <th class="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeItems.value.map((item, i) => {
                        const detailUrl = new URL("https://www.bricklink.com/v2/inventory_detail.page");
                        if (storeItemId.value) detailUrl.searchParams.set("itemID", String(storeItemId.value));
                        if (selectedColorId.value !== null && selectedColorId.value > 0) {
                          detailUrl.searchParams.set("colorID", String(selectedColorId.value));
                        }
                        return (
                          <tr key={i}>
                            <td class="text-right font-mono">{item.invQty}</td>
                            <td class="text-right font-mono">{formatPrice(item.nativePrice)}</td>
                            <td>
                              <ConditionBadge condition={item.invNew === "New" ? "N" : "U"} />
                            </td>
                            <td class="text-base-content/70 text-sm">{item.invDescription}</td>
                            <td>
                              <a
                                href={detailUrl.toString()}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="btn btn-ghost btn-xs btn-square"
                                title="View on BrickLink"
                              >
                                <span class="iconify lucide--external-link size-3.5"></span>
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-4">Marketplace Items</h2>
            {marketplaceError.value && (
              <div role="alert" class="alert alert-error mb-4">
                <span class="iconify lucide--alert-circle size-5"></span>
                <div>{marketplaceError.value}</div>
              </div>
            )}
            {marketplaceLoading.value && marketplaceItems.value === null
              ? (
                // Initial load or color change — no data yet, show centred spinner
                <div class="flex justify-center py-10">
                  <span class="loading loading-spinner loading-md"></span>
                </div>
              )
              : marketplaceItems.value === null
              ? (
                <div class="flex flex-col items-center py-10 text-base-content/50 border border-base-content/10 rounded-box">
                  <span class="iconify lucide--shopping-cart size-10 mb-2"></span>
                  <p class="text-sm">Enter an item ID and click search to load marketplace listings.</p>
                </div>
              )
              : marketplaceItems.value.length === 0
              ? (
                <div class="flex flex-col items-center py-10 text-base-content/50 border border-base-content/10 rounded-box">
                  <span class="iconify lucide--shopping-cart size-10 mb-2"></span>
                  <p class="text-sm">No marketplace listings found.</p>
                </div>
              )
              : (() => {
                const totalPages = Math.ceil((marketplaceTotalCount.value ?? 0) / 10);
                return (
                  // Wrap in relative so the loading overlay can cover table + pagination together
                  <div class="relative">
                    {marketplaceLoading.value && (
                      <div class="absolute inset-0 z-10 flex items-center justify-center rounded-box bg-base-100/70 backdrop-blur-[1px]">
                        <span class="loading loading-spinner loading-md"></span>
                      </div>
                    )}
                    <div class="overflow-x-auto rounded-box border border-base-content/10">
                      <table class="table table-sm">
                        <thead>
                          <tr>
                            <th>Store</th>
                            <th class="text-right">Qty</th>
                            <th class="text-right">Price</th>
                            <th>Condition</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marketplaceItems.value.map((item, i) => (
                            <tr key={i}>
                              <td class="font-medium">
                                {item.strStorename}{" "}
                                <span class="text-base-content/50 font-normal text-sm">
                                  ({item.n4SellerFeedbackScore})
                                </span>
                              </td>
                              <td class="text-right font-mono">{item.n4Qty}</td>
                              <td class="text-right font-mono">{formatPrice(item.mInvSalePrice)}</td>
                              <td>
                                <ConditionBadge condition={item.codeNew as "N" | "U"} />
                              </td>
                              <td class="text-base-content/70 text-sm">{item.strDesc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div class="flex items-center justify-between mt-3">
                        <button
                          type="button"
                          class="btn btn-sm btn-ghost"
                          disabled={marketplacePage.value <= 1 || marketplaceLoading.value}
                          onClick={() => fetchMarketplacePage(marketplacePage.value - 1)}
                        >
                          <span class="iconify lucide--chevron-left size-4"></span>
                          Prev
                        </button>
                        <span class="text-sm text-base-content/70">
                          Page {marketplacePage.value} of {totalPages}
                          {marketplaceTotalCount.value !== null &&
                            <span class="ml-1">({marketplaceTotalCount.value} total)</span>}
                        </span>
                        <button
                          type="button"
                          class="btn btn-sm btn-ghost"
                          disabled={marketplacePage.value >= totalPages || marketplaceLoading.value}
                          onClick={() => fetchMarketplacePage(marketplacePage.value + 1)}
                        >
                          Next
                          <span class="iconify lucide--chevron-right size-4"></span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
          </section>
        </div>
      </div>

      {catalogItem.value && (
        <dialog ref={imageDialogRef} class="modal">
          <div class="modal-box flex flex-col items-center p-6 max-w-xl">
            <form method="dialog">
              <button type="submit" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>
            <img
              src={`https:${colorImageUrl.value ?? catalogItem.value.image_url}`}
              alt={catalogItem.value.name}
              class="max-w-full max-h-[70vh] object-contain"
            />
            <p class="mt-3 text-sm font-medium text-center">{catalogItem.value.name}</p>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button type="submit">close</button>
          </form>
        </dialog>
      )}
    </>
  );
}
