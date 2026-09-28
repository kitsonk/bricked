import { listPackageTypes } from "@/utils/kv.ts";
import type { PackageType } from "@/utils/types.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type PackageTypesData = { packageTypes: PackageType[] };

export async function loadPackageTypes(): Promise<PageResult<PackageTypesData>> {
  const packageTypes = await listPackageTypes();
  return { kind: "data", data: { packageTypes } };
}
