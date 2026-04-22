import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, saveColor, saveColorsMeta } from "@/utils/kv.ts";

export async function refreshColors(): Promise<number> {
  const creds = getCredentials();
  if (!creds) throw new Error("BrickLink credentials not configured");
  const client = new BricklinkClient(creds);
  const colors = await client.getColors();
  for (const color of colors) {
    await saveColor(color);
  }
  await saveColorsMeta({ lastRefreshedAt: new Date().toISOString(), count: colors.length });
  return colors.length;
}
