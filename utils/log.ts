import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getKvSink } from "@kitsonk/logtape-kv-sink";

import { kv } from "./kv.ts";

const logger = getLogger("bricked");

const lowestLevel = (process.env.LOG_LEVEL ?? "debug") as "debug" | "info" | "warning" | "error" | "fatal";

// Vite re-evaluates this module on every HMR update. Without this guard Logtape is
// reconfigured and the two process listeners are stacked on every save.
const LOGTAPE = Symbol.for("bricked.logtape");
const logtapeGlobals = globalThis as Record<symbol, boolean>;
const firstLoad = !logtapeGlobals[LOGTAPE];
if (firstLoad) logtapeGlobals[LOGTAPE] = true;

if (firstLoad) {
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection\n{error}", {
      error: reason instanceof Error ? reason.stack : "[Unknown Error]",
    });
  });

  process.on("uncaughtException", (err) => {
    logger.error("Unhandled error\n{error}", {
      error: err instanceof Error ? err.stack : "[Unknown Error]",
    });
  });

  await configure({
    sinks: { console: getConsoleSink(), kv: getKvSink(kv()) },
    loggers: [
      { category: "bricked", lowestLevel, sinks: ["console", "kv"] },
      // Log meta information at a lower level to avoid spamming the console.
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
    ],
  });
}

export { getLogger };
