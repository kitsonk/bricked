import { listDriveThruTemplates, listTemplateRules } from "@/utils/kv.ts";
import type { DriveThruTemplate, TemplateRule } from "@/utils/types.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type DriveThruRulesData = {
  rules: TemplateRule[];
  templates: DriveThruTemplate[];
};

export async function loadDriveThruRules(): Promise<PageResult<DriveThruRulesData>> {
  const [rules, templates] = await Promise.all([
    listTemplateRules(),
    listDriveThruTemplates(),
  ]);
  return { kind: "data", data: { rules, templates } };
}
