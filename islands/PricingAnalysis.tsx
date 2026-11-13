import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import type { PricingAnalysisResponse } from "@/routes/api/pricing/index.ts";
import { bricklinkCatalogUrl } from "@/utils/format.ts";
import { decodeHtml } from "@/utils/html.ts";
import type { PricingSettings } from "@/utils/types.ts";

interface PricingAnalysisProps {
  initialSettings: PricingSettings | null;
}

type ItemType = "P" | "S" | "M";
type Condition = "N" | "U";

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: "P", label: "Part" },
  { value: "S", label: "Set" },
  { value: "M", label: "Minifigure" },
];

const TIER_LABELS = { premium: "Premium", mid: "Mid-point", competitive: "Competitive" } as const;
const TIER_ORDER = ["premium", "mid", "competitive"] as const;

function money(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(2);
}

/** BrickLink image URLs are protocol-relative. */
function imageSrc(raw: string | null): string | null {
  if (!raw) return null;
  return raw.startsWith("//") ? `https:${raw}` : raw;
}

function GuideStats({ title, guide }: { title: string; guide: PricingAnalysisResponse["market"]["stock"] }) {
  if (!guide) return null;
  return (
    <div>
      <h3 class="font-semibold mb-2">{title}</h3>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <span class="text-base-content/60">Lots / times sold</span>
        <span class="text-right tabular-nums">{guide.unit_quantity}</span>
        <span class="text-base-content/60">Total quantity</span>
        <span class="text-right tabular-nums">{guide.total_quantity}</span>
        <span class="text-base-content/60">Min price</span>
        <span class="text-right tabular-nums">{money(Number.parseFloat(guide.min_price))}</span>
        <span class="text-base-content/60">Average price</span>
        <span class="text-right tabular-nums">{money(Number.parseFloat(guide.avg_price))}</span>
        <span class="text-base-content/60">Quantity average</span>
        <span class="text-right tabular-nums">{money(Number.parseFloat(guide.qty_avg_price))}</span>
        <span class="text-base-content/60">Max price</span>
        <span class="text-right tabular-nums">{money(Number.parseFloat(guide.max_price))}</span>
      </div>
    </div>
  );
}

export default function PricingAnalysis({ initialSettings }: PricingAnalysisProps) {
  const itemType = useSignal<ItemType>("P");
  const itemNo = useSignal("");
  const colorId = useSignal<number | null>(null);
  const ownQty = useSignal("1");
  const condition = useSignal<Condition>("U");

  const colors = useSignal<{ color_id: number; color_name: string }[]>([]);
  const loading = useSignal(false);
  const error = useSignal<string | null>(null);
  const result = useSignal<PricingAnalysisResponse | null>(null);

  const priceInput = useSignal("");
  const copied = useSignal(false);
  const colorRequestSeq = useRef(0);
  const imageDialogRef = useRef<HTMLDialogElement>(null);

  const configuredStores =
    initialSettings === null
      ? 0
      : initialSettings.tiers.premium.length +
        initialSettings.tiers.mid.length +
        initialSettings.tiers.competitive.length;

  // Populate the colour selector for the item currently typed in.
  useEffect(() => {
    const no = itemNo.value.trim();
    if (!no) {
      colors.value = [];
      return;
    }
    const timer = setTimeout(async () => {
      const requestId = ++colorRequestSeq.current;
      const params = new URLSearchParams({ itemno: no, itemtype: itemType.value, colors_only: "1" });
      try {
        const resp = await fetch(`/api/pricing?${params}`);
        const json = await resp.json();
        if (requestId !== colorRequestSeq.current) return;
        const list: { color_id: number; color_name: string }[] = resp.ok ? (json.colors ?? []) : [];
        colors.value = list;
        if (colorId.value !== null && !list.some((color) => color.color_id === colorId.value)) {
          colorId.value = null;
        }
      } catch {
        if (requestId === colorRequestSeq.current) colors.value = [];
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [itemType.value, itemNo.value]);

  async function analyze(e: Event) {
    e.preventDefault();
    const qty = Number.parseInt(ownQty.value, 10);
    if (!Number.isInteger(qty) || qty < 1) {
      error.value = "Enter a quantity of at least 1.";
      return;
    }
    loading.value = true;
    error.value = null;
    copied.value = false;

    const params = new URLSearchParams({
      itemno: itemNo.value.trim(),
      itemtype: itemType.value,
      qty: String(qty),
      cond: condition.value,
    });
    if (colorId.value !== null) params.set("color", String(colorId.value));

    try {
      const resp = await fetch(`/api/pricing?${params}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      result.value = json as PricingAnalysisResponse;
      priceInput.value = json.suggestion ? json.suggestion.price.toFixed(2) : "";
    } catch (err) {
      result.value = null;
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  }

  function nudge(delta: number) {
    const current = Number.parseFloat(priceInput.value);
    const next = (Number.isFinite(current) ? current : 0) + delta;
    priceInput.value = Math.max(0.01, Math.round(next * 100) / 100).toFixed(2);
  }

  async function accept() {
    const value = Number.parseFloat(priceInput.value);
    if (!Number.isFinite(value)) return;
    try {
      await navigator.clipboard.writeText(value.toFixed(2));
      copied.value = true;
      setTimeout(() => (copied.value = false), 2000);
    } catch {
      error.value = "Clipboard access was denied — copy the price manually.";
    }
  }

  const data = result.value;
  const selectedColorName = data?.colors.find((color) => color.color_id === data.colorId)?.color_name ?? null;

  return (
    <div class="flex flex-col gap-6">
      {error.value && (
        <div role="alert" class="alert alert-error">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{error.value}</div>
        </div>
      )}

      {configuredStores === 0 && (
        <div role="alert" class="alert alert-warning">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>
            No pricing stores configured. Add store slugs in{" "}
            <a class="link" href="/configuration">
              Configuration
            </a>{" "}
            first.
          </div>
        </div>
      )}

      <div class="card bg-base-200">
        <div class="card-body">
          <form onSubmit={analyze}>
            <div class="grid gap-3 md:grid-cols-6">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Type</legend>
                <select
                  class="select w-full"
                  value={itemType.value}
                  onChange={(e) => (itemType.value = e.currentTarget.value as ItemType)}
                >
                  {ITEM_TYPES.map((type) => (
                    <option value={type.value} key={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </fieldset>
              <fieldset class="fieldset md:col-span-2">
                <legend class="fieldset-legend">Item number</legend>
                <input
                  type="text"
                  class="input w-full"
                  placeholder="15535"
                  required
                  value={itemNo.value}
                  onInput={(e) => (itemNo.value = e.currentTarget.value)}
                />
              </fieldset>
              <fieldset class="fieldset md:col-span-2">
                <legend class="fieldset-legend">Colour</legend>
                <select
                  class="select w-full"
                  value={colorId.value === null ? "" : String(colorId.value)}
                  onChange={(e) =>
                    (colorId.value = e.currentTarget.value === "" ? null : Number(e.currentTarget.value))
                  }
                >
                  <option value="">All colours</option>
                  {colors.value.map((color) => (
                    <option value={String(color.color_id)} key={color.color_id}>
                      {color.color_name}
                    </option>
                  ))}
                </select>
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Your quantity</legend>
                <input
                  type="number"
                  class="input w-full"
                  min="1"
                  step="1"
                  required
                  value={ownQty.value}
                  onInput={(e) => (ownQty.value = e.currentTarget.value)}
                />
              </fieldset>
            </div>

            <div class="flex flex-wrap items-end gap-3 mt-2">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Condition</legend>
                <div class="join">
                  {(
                    [
                      { value: "U", label: "Used" },
                      { value: "N", label: "New" },
                    ] as { value: Condition; label: string }[]
                  ).map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      class={`btn join-item btn-sm ${condition.value === option.value ? "btn-primary" : ""}`}
                      onClick={() => (condition.value = option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button type="submit" class="btn btn-primary btn-sm" disabled={loading.value}>
                {loading.value && <span class="loading loading-spinner loading-xs"></span>}
                Analyse
              </button>
            </div>
          </form>
        </div>
      </div>

      {data?.stale && (
        <div role="alert" class="alert alert-warning">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>
            Competitor data may be outdated — showing cached results
            {data.staleAt ? ` (as of ${new Date(data.staleAt).toLocaleString()})` : ""}
          </div>
        </div>
      )}

      {loading.value && (
        <div class="flex justify-center py-10">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      )}

      {data && !loading.value && (
        <>
          <section class="card bg-base-200">
            <div class="card-body">
              <h2 class="text-lg font-semibold mb-3">Item Overview</h2>
              {data.catalogItem ? (
                <div class="border border-base-content/10 rounded-box p-4 flex gap-4 items-start">
                  <button
                    type="button"
                    class="relative group cursor-zoom-in shrink-0"
                    onClick={() => imageDialogRef.current?.showModal()}
                    aria-label="View full image"
                  >
                    <img
                      src={imageSrc(data.imageUrl ?? data.catalogItem.image_url) ?? ""}
                      alt={decodeHtml(data.catalogItem.name)}
                      class="w-24 h-24 object-contain rounded-box bg-base-200"
                    />
                    <div class="absolute inset-0 rounded-box bg-base-content/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span class="iconify lucide--zoom-in size-6 text-base-100"></span>
                    </div>
                  </button>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start gap-2 mb-1">
                      <h3 class="font-semibold text-base">
                        <a
                          href={bricklinkCatalogUrl(data.item.type, data.item.no)}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="link link-hover inline-flex items-center gap-1"
                        >
                          {decodeHtml(data.catalogItem.name)}
                          <span class="iconify lucide--external-link size-3.5 shrink-0"></span>
                        </a>
                      </h3>
                      {data.catalogItem.is_obsolete && (
                        <span class="badge badge-warning badge-sm shrink-0 mt-0.5">Obsolete</span>
                      )}
                    </div>
                    <p class="text-sm text-base-content/70">{data.catalogItem.year_released}</p>
                    {data.partCount !== null && <p class="text-sm text-base-content/70">{data.partCount} parts</p>}
                    <p class="text-sm text-base-content/70">
                      {selectedColorName ?? "All colours"} · {data.condition === "N" ? "New" : "Used"}
                    </p>
                  </div>
                </div>
              ) : (
                <div class="flex flex-col items-center py-10 text-base-content/50 border border-base-content/10 rounded-box">
                  <span class="iconify lucide--package size-10 mb-2"></span>
                  <p class="text-sm">Item details are unavailable for this item.</p>
                </div>
              )}
            </div>
          </section>

          <section class="card bg-base-200">
            <div class="card-body">
              <h2 class="text-lg font-semibold">
                Suggested price
                <span class="text-base-content/50 font-normal text-sm ml-2">
                  {data.item.no}
                  {data.item.name ? ` — ${data.item.name}` : ""} · {data.condition === "N" ? "New" : "Used"} · qty{" "}
                  {data.ownQty}
                </span>
              </h2>

              {data.suggestion === null ? (
                <div class="alert alert-warning">
                  <span class="iconify lucide--alert-circle size-5"></span>
                  <div>No price suggestion is available for this item and quantity.</div>
                </div>
              ) : (
                <>
                  <div class="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      class="btn btn-circle btn-sm"
                      title="Decrease by 0.01"
                      onClick={() => nudge(-0.01)}
                    >
                      <span class="iconify lucide--minus size-4"></span>
                    </button>
                    <input
                      type="number"
                      class="input input-lg w-36 text-center tabular-nums text-2xl"
                      step="0.01"
                      min="0.01"
                      value={priceInput.value}
                      onInput={(e) => (priceInput.value = e.currentTarget.value)}
                    />
                    <button
                      type="button"
                      class="btn btn-circle btn-sm"
                      title="Increase by 0.01"
                      onClick={() => nudge(0.01)}
                    >
                      <span class="iconify lucide--plus size-4"></span>
                    </button>
                    <div class="text-sm text-base-content/70">
                      Suggested band {money(data.suggestion.bandLow)} – {money(data.suggestion.bandHigh)}
                    </div>
                  </div>

                  <p class="text-sm text-base-content/60">
                    Blend {money(data.suggestion.breakdown.blend)} × quantity factor{" "}
                    {data.suggestion.breakdown.uplift.toFixed(2)}
                    {data.suggestion.breakdown.floorCapApplied ? " — saturating stock, priced at the market floor" : ""}
                    {data.suggestion.breakdown.highCap !== null
                      ? ` · capped at ${money(data.suggestion.breakdown.highCap)}`
                      : ""}
                  </p>

                  <div class="flex items-center gap-3">
                    <button type="button" class="btn btn-primary" onClick={accept}>
                      <span class="iconify lucide--copy size-4"></span>
                      Accept &amp; copy
                    </button>
                    {copied.value && <span class="text-success text-sm">Copied ✓</span>}
                  </div>
                  <p class="text-xs text-base-content/50">
                    Copying puts the price on your clipboard — your store prices are never changed.
                  </p>
                </>
              )}
            </div>
          </section>

          <section class="card bg-base-200">
            <div class="card-body">
              <h2 class="text-lg font-semibold mb-3">Tier stores</h2>
              {TIER_ORDER.map((tier) => {
                const stores = data.stores.filter((store) => store.tier === tier);
                if (stores.length === 0) return null;
                return (
                  <div class="mb-5" key={tier}>
                    <div class="flex items-baseline justify-between mb-1">
                      <h3 class="font-semibold">{TIER_LABELS[tier]}</h3>
                      <span class="text-sm text-base-content/60">Tier price: {money(data.tierPrices[tier])}</span>
                    </div>
                    <div class="overflow-x-auto rounded-box border border-base-content/10">
                      <table class="table table-sm">
                        <thead>
                          <tr>
                            <th>Store</th>
                            <th class="text-right">Lots</th>
                            <th class="text-right">Price</th>
                            <th class="text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stores.map((store) => (
                            <tr key={store.slug}>
                              <td class="font-medium">{store.name ?? store.slug}</td>
                              <td class="text-right tabular-nums">{store.lots}</td>
                              <td class="text-right tabular-nums">
                                {store.price === null ? (
                                  <span class="text-base-content/40">not selling</span>
                                ) : (
                                  money(store.price)
                                )}
                              </td>
                              <td class="text-right tabular-nums">{store.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div class="grid gap-6 lg:grid-cols-2">
            <section class="card bg-base-200">
              <div class="card-body">
                <h2 class="text-lg font-semibold mb-3">Market</h2>
                <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
                  <span class="text-base-content/60">Lots for sale</span>
                  <span class="text-right tabular-nums">{data.market.lotsForSale ?? "—"}</span>
                  <span class="text-base-content/60">Sellers seen</span>
                  <span class="text-right tabular-nums">{data.market.sellersSeen ?? "—"}</span>
                  <span class="text-base-content/60">Floor price</span>
                  <span class="text-right tabular-nums">{money(data.market.floorPrice)}</span>
                  <span class="text-base-content/60">Median price</span>
                  <span class="text-right tabular-nums">{money(data.market.medianPrice)}</span>
                </div>
                <GuideStats title="Current stock guide" guide={data.market.stock} />
              </div>
            </section>

            <section class="card bg-base-200">
              <div class="card-body">
                <h2 class="text-lg font-semibold mb-3">Sales history (6 months)</h2>
                <GuideStats title="Sold guide" guide={data.history.sold} />
                {data.history.monthly.length > 0 ? (
                  <div class="overflow-x-auto rounded-box border border-base-content/10 mt-3">
                    <table class="table table-xs">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th class="text-right">Qty</th>
                          <th class="text-right">Avg price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.history.monthly.map((row) => (
                          <tr key={row.month}>
                            <td>{row.month}</td>
                            <td class="text-right tabular-nums">{row.qty}</td>
                            <td class="text-right tabular-nums">{money(row.avgPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p class="text-sm text-base-content/50 mt-3">No recorded sales in the last six months.</p>
                )}
              </div>
            </section>
          </div>

          {data.warnings.length > 0 && (
            <section class="card bg-base-200">
              <div class="card-body">
                <h2 class="text-lg font-semibold mb-2">Warnings</h2>
                <ul class="list-disc list-inside text-sm text-base-content/70">
                  {data.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}

      {data?.catalogItem && (
        <dialog ref={imageDialogRef} class="modal">
          <div class="modal-box flex flex-col items-center p-6 max-w-xl">
            <form method="dialog">
              <button type="submit" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                ✕
              </button>
            </form>
            <img
              src={imageSrc(data.imageUrl ?? data.catalogItem.image_url) ?? ""}
              alt={decodeHtml(data.catalogItem.name)}
              class="max-w-full max-h-[70vh] object-contain"
            />
            <p class="mt-3 text-sm font-medium text-center">{decodeHtml(data.catalogItem.name)}</p>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button type="submit">close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
