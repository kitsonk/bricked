import { App, staticFiles } from "fresh";
import logging from "@/middleware/logging.ts";
import type { State } from "@/utils/fresh.ts";
import { buildCrm } from "@/utils/crm.ts";
import { refreshColors } from "@/utils/colors.ts";
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

// Refresh BrickLink color cache once every 24 hours.
Deno.cron("colors-refresh", "0 1 * * *", async () => {
  logger.info`Cron: starting scheduled colors refresh`;
  try {
    const count = await refreshColors();
    logger.info`Cron: colors refresh complete — ${count} colors cached`;
  } catch (err) {
    logger.error`Cron: colors refresh failed: ${err}`;
  }
});
