import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { CustomersContent, handler } from "@/routes/customers/index.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function CustomersPartial({ data }) {
  return (
    <Partial name="main">
      <CustomersContent data={data} />
    </Partial>
  );
});
