import { App, staticFiles } from "fresh";
import logging from "@/middleware/logging.ts";
import type { State } from "@/utils/fresh.ts";
import { buildCrm } from "@/utils/crm.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "main"]);

export const app = new App<State>();

app
  .use(staticFiles(), logging())
  .fsRoutes();

// Refresh the CRM database once every 24 hours.
Deno.cron("crm-refresh", "0 0 * * *", async () => {
  logger.info`Cron: starting scheduled CRM refresh`;
  try {
    await buildCrm();
  } catch (err) {
    logger.error`Cron: CRM refresh failed: ${err}`;
  }
});
