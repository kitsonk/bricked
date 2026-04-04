import { define } from "@/utils/fresh.ts";
import { getCredentials } from "@/utils/kv.ts";
import { buildCrm } from "@/utils/crm.ts";

export const handler = define.handlers({
  async POST(_ctx) {
    const creds = getCredentials();
    if (!creds) {
      return Response.json({ error: "Not configured" }, { status: 401 });
    }
    try {
      await buildCrm();
      return Response.json({ ok: true });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
});
