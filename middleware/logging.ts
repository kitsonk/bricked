import { getLogger } from "@/utils/log.ts";
import type { RespondingMiddleware } from "@/middleware/types.ts";

const logger = getLogger(["bricked"]);

export const logging: RespondingMiddleware = async (context, next) => {
  performance.mark("request-start");
  const res = await next();
  performance.mark("request-end");
  performance.measure("request-duration", { start: "request-start", end: "request-end" });
  const duration = performance.getEntriesByName("request-duration").pop();
  if (duration) {
    logger.debug("{method} {url} - {status} - {duration}ms", {
      method: context.request.method,
      url: context.request.url,
      status: res.status,
      duration: duration.duration.toFixed(2),
    });
  }
  return res;
};
