import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { handler, LogsContent } from "@/routes/admin/logs.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function LogsPartial({ data }) {
  return (
    <Partial name="main">
      <LogsContent data={data} />
    </Partial>
  );
});
