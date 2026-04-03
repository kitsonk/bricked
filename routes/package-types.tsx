import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { listPackageTypes } from "@/utils/kv.ts";
import type { PackageType } from "@/utils/types.ts";
import PackageTypes from "@/islands/PackageTypes.tsx";

export const handler = define.handlers<{ packageTypes: PackageType[] }>({
  async GET() {
    const packageTypes = await listPackageTypes();
    return page({ packageTypes });
  },
});

export default define.page<typeof handler>(function PackageTypesPage({ data }) {
  return (
    <AppFrame>
      <h1 class="text-2xl font-bold mb-6">Package Types</h1>
      <PackageTypes initialItems={data.packageTypes} />
    </AppFrame>
  );
});
