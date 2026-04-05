import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { handler, ShippingMethodsContent } from "@/routes/shipping-methods.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function ShippingMethodsPartial({ data }) {
  return (
    <Partial name="main">
      <ShippingMethodsContent data={data} />
    </Partial>
  );
});
