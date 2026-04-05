import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { listDriveThruTemplates } from "@/utils/kv.ts";
import type { DriveThruTemplate } from "@/utils/types.ts";
import DriveThruTemplates from "@/islands/DriveThruTemplates.tsx";

export type DriveThruTemplatesData = { templates: DriveThruTemplate[] };

export const handler = define.handlers<DriveThruTemplatesData>({
  async GET(_ctx) {
    const templates = await listDriveThruTemplates();
    return page({ templates });
  },
});

export function DriveThruTemplatesContent({ data }: { data: DriveThruTemplatesData }) {
  return (
    <div class="max-w-2xl">
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Drive Thru Templates</h1>
        <p class="text-sm text-base-content/60 mt-1">
          Templates are used to preview the message that will be sent to buyers via BrickLink's Drive Thru feature.
        </p>
      </div>
      <DriveThruTemplates initialTemplates={data.templates} />
    </div>
  );
}

export default define.page<typeof handler>(function TemplatesPage({ data }) {
  return (
    <AppFrame>
      <DriveThruTemplatesContent data={data} />
    </AppFrame>
  );
});
