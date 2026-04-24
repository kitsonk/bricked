import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { CustomerDetailContent, handler } from "@/routes/customers/[username].tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function CustomerDetailPartial({ data }) {
  return (
    <Partial name="main">
      <CustomerDetailContent data={data} />
    </Partial>
  );
});
