import { define } from "@/utils/fresh.ts";
import { refreshColors } from "@/utils/colors.ts";
import { getColorsMeta, listColors } from "@/utils/kv.ts";

export const handler = define.handlers({
  async POST(_ctx) {
    try {
      await refreshColors();
      const [colors, meta] = await Promise.all([listColors(), getColorsMeta()]);
      return Response.json({ colors, meta });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
});
