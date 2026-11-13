import { useSignal } from "@preact/signals";
import type { PricingSettings } from "@/utils/types.ts";

interface PricingSettingsProps {
  initialPricing: PricingSettings | null;
}

type FxRow = { code: string; rate: string };

const TIER_FIELDS = [
  { key: "premium", label: "Premium stores", hint: "Aggressive sellers — the top of the market" },
  { key: "mid", label: "Mid-point stores", hint: "Typical pricing for this item" },
  { key: "competitive", label: "Competitive stores", hint: "Your closest competitors — weighted heaviest" },
] as const;

function toLines(slugs: string[]): string {
  return slugs.join("\n");
}

function toSlugs(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function PricingSettingsForm({ initialPricing }: PricingSettingsProps) {
  const premium = useSignal(toLines(initialPricing?.tiers.premium ?? []));
  const mid = useSignal(toLines(initialPricing?.tiers.mid ?? []));
  const competitive = useSignal(toLines(initialPricing?.tiers.competitive ?? []));
  const marketCountry = useSignal(initialPricing?.marketCountry ?? "AU");
  const analysisCurrency = useSignal(initialPricing?.analysisCurrency ?? "AUD");
  const fxRates = useSignal<FxRow[]>(
    Object.entries(initialPricing?.fxRates ?? {}).map(([code, rate]) => ({ code, rate: String(rate) })),
  );

  const saving = useSignal(false);
  const saved = useSignal(false);
  const error = useSignal<string | null>(null);

  const tierSignals = { premium, mid, competitive };

  function updateRow(index: number, patch: Partial<FxRow>) {
    fxRates.value = fxRates.value.map((row, i) => (i === index ? { ...row, ...patch } : row));
  }

  function removeRow(index: number) {
    fxRates.value = fxRates.value.filter((_, i) => i !== index);
  }

  function addRow() {
    fxRates.value = [...fxRates.value, { code: "", rate: "" }];
  }

  async function save(e: Event) {
    e.preventDefault();
    saving.value = true;
    saved.value = false;
    error.value = null;

    const rates: Record<string, number> = {};
    for (const row of fxRates.value) {
      if (!row.code.trim() && !row.rate.trim()) continue;
      rates[row.code.trim().toUpperCase()] = Number.parseFloat(row.rate);
    }

    const body: PricingSettings = {
      tiers: {
        premium: toSlugs(premium.value),
        mid: toSlugs(mid.value),
        competitive: toSlugs(competitive.value),
      },
      marketCountry: marketCountry.value.trim().toUpperCase(),
      analysisCurrency: analysisCurrency.value.trim().toUpperCase(),
      fxRates: rates,
    };

    try {
      const resp = await fetch("/api/pricing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      premium.value = toLines(json.tiers.premium);
      mid.value = toLines(json.tiers.mid);
      competitive.value = toLines(json.tiers.competitive);
      marketCountry.value = json.marketCountry;
      analysisCurrency.value = json.analysisCurrency;
      fxRates.value = Object.entries(json.fxRates).map(([code, rate]) => ({ code, rate: String(rate) }));
      saved.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      saving.value = false;
    }
  }

  return (
    <div class="mt-6">
      {error.value && (
        <div role="alert" class="alert alert-error mb-4">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{error.value}</div>
        </div>
      )}

      {saved.value && (
        <div role="alert" class="alert alert-success mb-4">
          <span class="iconify lucide--check-circle size-5"></span>
          <div>Pricing settings saved.</div>
        </div>
      )}

      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="text-lg font-semibold">Pricing Stores</h2>
          <p class="text-sm text-base-content/60 mb-4">
            One store slug or store URL per line. The analysis weights competitive stores heaviest, then mid-point, then
            premium.
          </p>
          <form onSubmit={save}>
            <div class="grid gap-4 lg:grid-cols-3">
              {TIER_FIELDS.map((field) => (
                <fieldset class="fieldset" key={field.key}>
                  <legend class="fieldset-legend">{field.label}</legend>
                  <textarea
                    class="textarea h-40 w-full font-mono text-sm"
                    placeholder="store.bricklink.com/StoreName"
                    value={tierSignals[field.key].value}
                    onInput={(e) => (tierSignals[field.key].value = e.currentTarget.value)}
                  />
                  <p class="label">{field.hint}</p>
                </fieldset>
              ))}
            </div>

            <div class="divider my-2"></div>
            <h3 class="font-semibold">Market &amp; Currency</h3>
            <div class="grid gap-3 sm:grid-cols-2 max-w-xl">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Market country</legend>
                <input
                  type="text"
                  class="input w-full"
                  placeholder="AU"
                  maxLength={2}
                  value={marketCountry.value}
                  onInput={(e) => (marketCountry.value = e.currentTarget.value)}
                />
                <p class="label">Two-letter code, or empty for worldwide.</p>
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Analysis currency</legend>
                <input
                  type="text"
                  class="input w-full"
                  placeholder="AUD"
                  maxLength={3}
                  value={analysisCurrency.value}
                  onInput={(e) => (analysisCurrency.value = e.currentTarget.value)}
                />
                <p class="label">All prices are converted to this currency.</p>
              </fieldset>
            </div>

            <h3 class="font-semibold mt-4">Exchange rates</h3>
            <p class="text-sm text-base-content/60 mb-2">
              Units of {analysisCurrency.value || "the analysis currency"} per 1 unit of the listed currency.
            </p>
            <div class="flex flex-col gap-2 max-w-md">
              {fxRates.value.map((row, index) => (
                <div class="flex items-center gap-2" key={index}>
                  <input
                    type="text"
                    class="input input-sm w-24 font-mono uppercase"
                    placeholder="USD"
                    maxLength={3}
                    value={row.code}
                    onInput={(e) => updateRow(index, { code: e.currentTarget.value })}
                  />
                  <input
                    type="number"
                    class="input input-sm grow"
                    placeholder="0.65"
                    step="any"
                    min="0"
                    value={row.rate}
                    onInput={(e) => updateRow(index, { rate: e.currentTarget.value })}
                  />
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-square"
                    title="Remove rate"
                    onClick={() => removeRow(index)}
                  >
                    <span class="iconify lucide--trash-2 size-4"></span>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-2" onClick={addRow}>
              <span class="iconify lucide--plus size-4"></span>
              Add rate
            </button>

            <div class="mt-6">
              <button type="submit" class="btn btn-primary" disabled={saving.value}>
                {saving.value && <span class="loading loading-spinner loading-xs"></span>}
                Save pricing settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
