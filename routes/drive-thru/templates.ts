import { listDriveThruTemplates } from "@/utils/kv.ts";
import type { DriveThruTemplate } from "@/utils/types.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type DriveThruTemplatesData = { templates: DriveThruTemplate[] };

export async function loadDriveThruTemplates(): Promise<PageResult<DriveThruTemplatesData>> {
  const templates = await listDriveThruTemplates();
  return { kind: "data", data: { templates } };
}
