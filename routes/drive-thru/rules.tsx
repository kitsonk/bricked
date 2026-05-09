import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { listDriveThruTemplates, listTemplateRules } from "@/utils/kv.ts";
import type { DriveThruTemplate, TemplateRule } from "@/utils/types.ts";
import DriveThruRules from "@/islands/DriveThruRules.tsx";

export type DriveThruRulesData = {
  rules: TemplateRule[];
  templates: DriveThruTemplate[];
};

export const handler = define.handlers<DriveThruRulesData>({
  async GET(_ctx) {
    const [rules, templates] = await Promise.all([
      listTemplateRules(),
      listDriveThruTemplates(),
    ]);
    return page({ rules, templates });
  },
});

export function DriveThruRulesContent({ data }: { data: DriveThruRulesData }) {
  return (
    <div class="max-w-3xl">
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Drive Thru Rules</h1>
        <p class="text-sm text-base-content/60 mt-1">
          Define rules to automatically select the right Drive Thru template based on order and customer properties.
        </p>
      </div>
      <DriveThruRules initialRules={data.rules} templates={data.templates} />
    </div>
  );
}

export default define.page<typeof handler>(function RulesPage({ data }) {
  return (
    <AppFrame>
      <DriveThruRulesContent data={data} />
    </AppFrame>
  );
});
