import { getPricingSettings } from "@/utils/kv.ts";
import type { PricingSettings } from "@/utils/types.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type PricingData = { settings: PricingSettings | null };

export async function loadPricing(): Promise<PageResult<PricingData>> {
  const settings = await getPricingSettings();
  return { kind: "data", data: { settings } };
}
