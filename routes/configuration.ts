import { getSenderAddress } from "@/utils/kv.ts";
import type { AusPostAddress } from "@/utils/types.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type ConfigurationData = { address: AusPostAddress | null };

export async function loadConfiguration(): Promise<PageResult<ConfigurationData>> {
  const address = await getSenderAddress();
  return { kind: "data", data: { address } };
}
