import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { DriveThruTemplatesContent, handler } from "@/routes/drive-thru/templates.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function DriveThruTemplatesPartial({ data }) {
  return (
    <Partial name="main">
      <DriveThruTemplatesContent data={data} />
    </Partial>
  );
});
