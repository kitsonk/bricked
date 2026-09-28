import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getKvSink } from "@kitsonk/logtape-kv-sink";

import { kv } from "./kv.ts";

const logger = getLogger("bricked");

const lowestLevel = (Deno.env.get("LOG_LEVEL") ?? "debug") as "debug" | "info" | "warning" | "error" | "fatal";

// `deno task dev` re-evaluates this module on every HMR update. Without this guard Logtape is
// reconfigured and the two global listeners are stacked on every save.
const LOGTAPE = Symbol.for("bricked.logtape");
const logtapeGlobals = globalThis as Record<symbol, boolean>;
const firstLoad = !logtapeGlobals[LOGTAPE];
if (firstLoad) logtapeGlobals[LOGTAPE] = true;

if (firstLoad) {
  globalThis.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    logger.error("Unhandled rejection\n{error}", {
      error: event.reason instanceof Error ? event.reason.stack : "[Unknown Error]",
    });
  });

  globalThis.addEventListener("error", (event) => {
    event.preventDefault();
    logger.error("Unhandled error\n{error}", {
      error: event.error instanceof Error ? event.error.stack : "[Unknown Error]",
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
