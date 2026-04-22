import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { ColorsContent, handler } from "@/routes/colors.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function ColorsPartial({ data }) {
  return (
    <Partial name="main">
      <ColorsContent data={data} />
    </Partial>
  );
});
