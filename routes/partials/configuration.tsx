import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { ConfigurationContent, handler } from "@/routes/configuration.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function ConfigurationPartial({ data }) {
  return (
    <Partial name="main">
      <ConfigurationContent data={data} />
    </Partial>
  );
});
