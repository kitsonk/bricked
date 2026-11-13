import { getPricingSettings, getSenderAddress } from "@/utils/kv.ts";
import type { AusPostAddress, PricingSettings } from "@/utils/types.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type ConfigurationData = { address: AusPostAddress | null; pricing: PricingSettings | null };

export async function loadConfiguration(): Promise<PageResult<ConfigurationData>> {
  const [address, pricing] = await Promise.all([getSenderAddress(), getPricingSettings()]);
  return { kind: "data", data: { address, pricing } };
}
