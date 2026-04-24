import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { handler, HomeContent } from "@/routes/index.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function HomePartial({ data }) {
  return (
    <Partial name="main">
      <HomeContent data={data} />
    </Partial>
  );
});
