import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { handler, InventoryContent } from "@/routes/inventory/index.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function InventoryPartial({ data }) {
  return (
    <Partial name="main">
      <InventoryContent data={data} />
    </Partial>
  );
});
