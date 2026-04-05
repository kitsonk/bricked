import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { handler, OrdersContent } from "@/routes/orders/index.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function OrdersPartial({ data }) {
  return (
    <Partial name="main">
      <OrdersContent data={data} />
    </Partial>
  );
});
