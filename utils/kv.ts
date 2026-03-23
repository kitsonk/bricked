import type { BricklinkCredentials, StoredNotification } from "@/utils/types.ts";

export function getCredentials(): BricklinkCredentials | null {
  const consumerKey = Deno.env.get("BRICKLINK_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("BRICKLINK_CONSUMER_SECRET");
  const tokenValue = Deno.env.get("BRICKLINK_TOKEN");
  const tokenSecret = Deno.env.get("BRICKLINK_TOKEN_SECRET");
  if (!consumerKey || !consumerSecret || !tokenValue || !tokenSecret) return null;
  return { consumerKey, consumerSecret, tokenValue, tokenSecret };
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
