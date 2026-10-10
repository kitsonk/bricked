import type { MiddlewareHandler } from "astro";
import cron from "node-cron";
import { logging } from "@/middleware/logging.ts";
import { banlist } from "@/middleware/banlist.ts";
import { auth } from "@/middleware/auth.ts";
import { originCheck } from "@/middleware/originCheck.ts";
import { buildCrm } from "@/utils/crm.ts";
import { refreshColors } from "@/utils/colors.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "middleware"]);

// Order matters: every request is logged, then CSRF-checked, banlist-checked, then authenticated.
// The origin check sits just inside logging so a rejected cross-site POST is still visible in the logs.
export const onRequest: MiddlewareHandler = (context, next) =>
  logging(context, () => originCheck(context, () => banlist(context, () => auth(context, next))));

// Vite re-evaluates this module on every HMR update, which would stack a second copy of each
// schedule. Track registrations process-wide.
const CRONS = Symbol.for("bricked.crons");
const cronsGlobal = globalThis as Record<symbol, Set<string> | undefined>;
const registeredCrons = cronsGlobal[CRONS] ?? new Set<string>();
cronsGlobal[CRONS] = registeredCrons;

function registerCron(name: string, spec: string, fn: () => Promise<void>): void {
  if (registeredCrons.has(name)) return;
  registeredCrons.add(name);
  // node-cron defaults to the host timezone; the old Deno.cron schedules were UTC, so pin it.
  cron.schedule(spec, fn, { timezone: "UTC" });
}

// Refresh the CRM database once every 24 hours.
registerCron("crm-refresh", "0 0 * * *", async () => {
  logger.info`Cron: starting scheduled CRM refresh`;
  try {
    await buildCrm();
  } catch (err) {
    logger.error`Cron: CRM refresh failed: ${err}`;
  }
});

// Refresh BrickLink color cache once every 24 hours.
registerCron("colors-refresh", "0 1 * * *", async () => {
  logger.info`Cron: starting scheduled colors refresh`;
  try {
    const count = await refreshColors();
    logger.info`Cron: colors refresh complete — ${count} colors cached`;
  } catch (err) {
    logger.error`Cron: colors refresh failed: ${err}`;
  }
});
