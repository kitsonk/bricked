import type { BricklinkCredentials, StoredNotification } from "@/utils/types.ts";

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

// Notifications are stored under ["notifications", <iso-timestamp>, <id>] so
// they naturally sort chronologically when listed.
function notificationKey(receivedAt: string, id: string): Deno.KvKey {
  return ["notifications", receivedAt, id];
}

export async function saveNotification(notification: StoredNotification): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(notificationKey(notification.receivedAt, notification.id), notification);
}

export async function listNotifications(): Promise<StoredNotification[]> {
  const kv = await Deno.openKv();
  const entries = kv.list<StoredNotification>({ prefix: ["notifications"] });
  const results: StoredNotification[] = [];
  for await (const entry of entries) {
    results.push(entry.value);
  }
  return results;
}
