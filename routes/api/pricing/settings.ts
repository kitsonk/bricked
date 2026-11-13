import type { APIContext } from "astro";
import { getPricingSettings, savePricingSettings } from "@/utils/kv.ts";
import { DEFAULT_FX_RATES, normalizeStoreSlug } from "@/utils/pricing.ts";
import type { PricingSettings } from "@/utils/types.ts";

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  tiers: { premium: [], mid: [], competitive: [] },
  marketCountry: "AU",
  analysisCurrency: "AUD",
  fxRates: { ...DEFAULT_FX_RATES },
};

const TIERS = ["premium", "mid", "competitive"] as const;

export async function GET(): Promise<Response> {
  return Response.json((await getPricingSettings()) ?? DEFAULT_PRICING_SETTINGS);
}

function bad(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

export async function PUT({ request }: APIContext): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Request body must be valid JSON");
  }
  if (typeof body !== "object" || body === null) return bad("Request body must be an object");
  const raw = body as Record<string, unknown>;

  const tiersRaw = raw.tiers;
  if (typeof tiersRaw !== "object" || tiersRaw === null) return bad("tiers must be an object");
  const tiersInput = tiersRaw as Record<string, unknown>;

  const tiers: PricingSettings["tiers"] = { premium: [], mid: [], competitive: [] };
  const tierBySlug = new Map<string, string>();

  for (const tier of TIERS) {
    const list = tiersInput[tier];
    if (!Array.isArray(list)) return bad(`tiers.${tier} must be an array`);
    for (const entry of list) {
      if (typeof entry !== "string") return bad("Tiers must contain store names as strings");
      const slug = normalizeStoreSlug(entry);
      if (!slug) continue;
      const existingTier = tierBySlug.get(slug);
      if (existingTier === tier) continue;
      if (existingTier) return bad(`store ${slug} appears in multiple tiers`);
      tierBySlug.set(slug, tier);
      tiers[tier].push(slug);
    }
  }

  const countryRaw = raw.marketCountry;
  if (typeof countryRaw !== "string") return bad("marketCountry must be a string");
  const marketCountry = countryRaw.trim().toUpperCase();
  if (marketCountry !== "" && !/^[A-Z]{2}$/.test(marketCountry)) {
    return bad("marketCountry must be a two-letter country code or empty for worldwide");
  }

  const currencyRaw = raw.analysisCurrency;
  if (typeof currencyRaw !== "string") return bad("analysisCurrency must be a string");
  const analysisCurrency = currencyRaw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(analysisCurrency)) {
    return bad("analysisCurrency must be a three-letter currency code");
  }

  const fxRatesRaw = raw.fxRates;
  if (typeof fxRatesRaw !== "object" || fxRatesRaw === null || Array.isArray(fxRatesRaw)) {
    return bad("fxRates must be an object of currency code to rate");
  }
  const fxRates: Record<string, number> = {};
  for (const [key, value] of Object.entries(fxRatesRaw as Record<string, unknown>)) {
    const code = key.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return bad(`Invalid currency code in fxRates: ${key}`);
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return bad(`Exchange rate for ${code} must be a number greater than zero`);
    }
    fxRates[code] = value;
  }

  const settings: PricingSettings = { tiers, marketCountry, analysisCurrency, fxRates };
  await savePricingSettings(settings);
  return Response.json(settings);
}
