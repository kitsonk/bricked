import type { PageResult } from "@/routes/pageResult.ts";

export type InventoryData = Record<never, never>;

export function loadInventory(): PageResult<InventoryData> {
  return { kind: "data", data: {} };
}
