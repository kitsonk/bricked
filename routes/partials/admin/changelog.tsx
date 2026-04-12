import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { ChangelogContent, handler } from "@/routes/admin/changelog.tsx";

export { handler };

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page<typeof handler>(function ChangelogPartial({ data }) {
  return (
    <Partial name="main">
      <ChangelogContent data={data} />
    </Partial>
  );
});
