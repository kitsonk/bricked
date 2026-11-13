/**
 * Pure pricing math for the pricing assistant. No I/O — the route assembles the
 * inputs from BrickLink listings and price guides, then calls `suggestPrice`.
 *
 * All monetary values handled here are already converted to the analysis currency.
 */

export const TIER_WEIGHTS = { competitive: 0.5, mid: 0.3, premium: 0.2 } as const;

/** Approximate rates seeding the settings; update occasionally. Units per 1 foreign unit. */
export const DEFAULT_FX_RATES: Record<string, number> = {
  USD: 0.65,
  EUR: 1.65,
  GBP: 1.95,
  NZD: 0.92,
  CAD: 1.1,
  JPY: 0.01,
};

const CURRENCY_PREFIXES: Record<string, string> = {
  "AU $": "AUD",
  "US $": "USD",
  "UK $": "GBP",
  "EU $": "EUR",
  "CA $": "CAD",
  "NZ $": "NZD",
  "JP $": "JPY",
  "£": "GBP",
  "€": "EUR",
  "¥": "JPY",
};

/** Scale the tier blend by how many units the user is listing. */
export function quantityUplift(ownQty: number): number {
  if (ownQty <= 2) return 1.6;
  if (ownQty <= 12) return 1.3;
  if (ownQty <= 49) return 1.15;
  if (ownQty <= 99) return 1.0;
  if (ownQty <= 199) return 0.9;
  return 0.8;
}

/** Parse a catalogifs native price like "AU $0.095" into a currency code and amount. */
export function parseNativePrice(raw: string): { code: string; amount: number } | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const upperPrefix = trimmed.toUpperCase();
  for (const [prefix, code] of Object.entries(CURRENCY_PREFIXES)) {
    if (upperPrefix.startsWith(prefix.toUpperCase())) {
      const amount = Number.parseFloat(trimmed.slice(prefix.length).replace(/[^0-9.+-]/g, ""));
      return Number.isFinite(amount) ? { code, amount } : null;
    }
  }
  return null;
}

/** Convert an amount in `code` to the analysis currency, or null when no rate exists. */
export function convertToAnalysis(
  amount: number,
  code: string,
  s: { analysisCurrency: string; fxRates: Record<string, number> },
): number | null {
  const from = code.trim().toUpperCase();
  const to = s.analysisCurrency.trim().toUpperCase();
  if (from === to) return amount;
  const rate = s.fxRates[from] ?? s.fxRates[from.toLowerCase()];
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
  return amount * rate;
}

/** Reduce a user-supplied store slug or store URL to the bare lowercase slug. */
export function normalizeStoreSlug(input: string): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^store\.bricklink\.com\//, "")
    .split(/[?#]/)[0]
    .replace(/\/+$/, "")
    .trim();
}

export interface TierStoreInput {
  slug: string;
  name: string | null;
  lots: { price: number; qty: number }[];
  excludedLots: number;
}

export interface PricingInput {
  ownQty: number;
  tiers: { premium: TierStoreInput[]; mid: TierStoreInput[]; competitive: TierStoreInput[] };
  marketFloorPrice: number | null;
  soldQty6mo: number | null;
}

export interface PricingSuggestion {
  price: number;
  bandLow: number;
  bandHigh: number;
  breakdown: {
    blend: number;
    uplift: number;
    highCap: number | null;
    floorCapApplied: boolean;
    floorCap: number | null;
  };
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function storePrice(store: TierStoreInput): number | null {
  if (store.lots.length === 0) return null;
  return median(store.lots.map((lot) => lot.price));
}

export function suggestPrice(input: PricingInput): PricingSuggestion | null {
  const tierNames = ["competitive", "mid", "premium"] as const;
  const tierPrices: Partial<Record<(typeof tierNames)[number], number>> = {};
  const tierMaxes: Partial<Record<(typeof tierNames)[number], number>> = {};
  const allStorePrices: number[] = [];

  for (const tier of tierNames) {
    const prices = input.tiers[tier]
      .map(storePrice)
      .filter((price): price is number => price !== null && Number.isFinite(price));
    allStorePrices.push(...prices);
    if (prices.length > 0) {
      tierPrices[tier] = median(prices);
      tierMaxes[tier] = Math.max(...prices);
    }
  }

  let weightSum = 0;
  let weighted = 0;
  for (const tier of tierNames) {
    const tierPrice = tierPrices[tier];
    if (tierPrice === undefined) continue;
    weightSum += TIER_WEIGHTS[tier];
    weighted += TIER_WEIGHTS[tier] * tierPrice;
  }
  if (weightSum === 0) return null;

  const blend = weighted / weightSum;
  const uplift = quantityUplift(input.ownQty);

  const premiumMax = tierMaxes.premium;
  const highCap =
    premiumMax !== undefined ? premiumMax * 1.2 : allStorePrices.length > 0 ? Math.max(...allStorePrices) * 1.2 : null;

  let price = blend * uplift;
  if (highCap !== null) price = Math.min(price, highCap);

  let floorCapApplied = false;
  const marketFloorPrice = input.marketFloorPrice;
  if (marketFloorPrice !== null && marketFloorPrice > 0) {
    const floorIsLow = marketFloorPrice <= 0.75 * blend;
    const exhausted =
      input.ownQty >= 100 || (input.ownQty >= 50 && input.soldQty6mo !== null && input.soldQty6mo < input.ownQty);
    if (floorIsLow && exhausted) {
      price = marketFloorPrice;
      floorCapApplied = true;
    }
  }

  const rounded = Math.max(round2(price), 0.01);
  return {
    price: rounded,
    bandLow: round2(rounded * 0.95),
    bandHigh: round2(rounded * 1.15),
    breakdown: {
      blend,
      uplift,
      highCap: highCap === null ? null : round2(highCap),
      floorCapApplied,
      floorCap: floorCapApplied ? round2(marketFloorPrice ?? 0) : null,
    },
  };
}
