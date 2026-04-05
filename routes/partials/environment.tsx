import { Partial } from "fresh/runtime";
import type { RouteConfig } from "fresh";
import { define } from "@/utils/fresh.ts";
import { EnvironmentContent } from "@/routes/environment.tsx";

export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true };

export default define.page(function EnvironmentPartial() {
  return (
    <Partial name="main">
      <EnvironmentContent />
    </Partial>
  );
});
