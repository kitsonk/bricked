import type { BricklinkCredentials } from "@/utils/types.ts";

const CREDENTIALS_KEY = ["settings", "credentials"] as const;

export async function getCredentials(): Promise<BricklinkCredentials | null> {
  const kv = await Deno.openKv();
  const result = await kv.get<BricklinkCredentials>(CREDENTIALS_KEY);
  return result.value;
}

export async function saveCredentials(creds: BricklinkCredentials): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(CREDENTIALS_KEY, creds);
}
