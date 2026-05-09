import { define } from "@/utils/fresh.ts";
import { getDefaultTemplateId, setDefaultTemplateId } from "@/utils/kv.ts";

export const handler = define.handlers({
  async GET() {
    const id = await getDefaultTemplateId();
    return Response.json({ defaultTemplateId: id });
  },

  async PUT(ctx) {
    const body = await ctx.req.json();
    const { defaultTemplateId } = body;
    if (typeof defaultTemplateId !== "string" || !defaultTemplateId.trim()) {
      return Response.json({ error: "defaultTemplateId is required" }, { status: 400 });
    }
    await setDefaultTemplateId(defaultTemplateId.trim());
    return Response.json({ defaultTemplateId: defaultTemplateId.trim() });
  },
});
