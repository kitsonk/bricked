import { define } from "@/utils/fresh.ts";
import { getCredentials, saveNotification } from "@/utils/kv.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "api", "notifications"]);

export const handler = define.handlers({
  // BrickLink sends an empty POST as a ping when notifications are available.
  // We respond by fetching the current notification list from the API and
  // persisting each entry to KV for later use.
  async POST(_ctx) {
    const creds = await getCredentials();
    if (!creds) {
      logger.warn`Received notification ping but no credentials are configured`;
      return new Response(null, { status: 503 });
    }

    const client = new BricklinkClient(creds);
    let notifications;
    try {
      notifications = await client.getNotifications();
    } catch (err) {
      logger.error`Failed to fetch notifications from BrickLink: ${err}`;
      return new Response(null, { status: 502 });
    }

    const receivedAt = new Date().toISOString();
    await Promise.all(
      notifications.map((n) =>
        saveNotification({
          ...n,
          id: crypto.randomUUID(),
          receivedAt,
        })
      ),
    );

    logger.info`Persisted ${notifications.length} notification(s) from BrickLink`;
    return new Response(null, { status: 204 });
  },
});
