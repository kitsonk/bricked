import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { handler, PackageTypesContent } from "@/routes/package-types.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function PackageTypesPartial({ data }) {
  return (
    <Partial name="main">
      <PackageTypesContent data={data} />
    </Partial>
  );
});
