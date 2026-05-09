import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { DriveThruRulesContent, handler } from "@/routes/drive-thru/rules.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function DriveThruRulesPartial({ data }) {
  return (
    <Partial name="main">
      <DriveThruRulesContent data={data} />
    </Partial>
  );
});
