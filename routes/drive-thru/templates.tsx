import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { listDriveThruTemplates } from "@/utils/kv.ts";
import type { DriveThruTemplate } from "@/utils/types.ts";
import DriveThruTemplates from "@/islands/DriveThruTemplates.tsx";

export const handler = define.handlers<{ templates: DriveThruTemplate[] }>({
  async GET(_ctx) {
    const templates = await listDriveThruTemplates();
    return page({ templates });
  },
});

export default define.page<typeof handler>(function TemplatesPage({ data }) {
  return (
    <AppFrame>
      <div class="p-6 max-w-2xl">
        <div class="mb-6">
          <h1 class="text-2xl font-bold">Drive Thru Templates</h1>
          <p class="text-sm text-base-content/60 mt-1">
            Templates are used to preview the message that will be sent to buyers via BrickLink's Drive Thru feature.
          </p>
        </div>
        <DriveThruTemplates initialTemplates={data.templates} />
      </div>
    </AppFrame>
  );
});
