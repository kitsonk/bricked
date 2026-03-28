import type { BLShippingMethod, ShippingMethod, ShippingMethodEnrichment } from "@/utils/types.ts";
import type { BricklinkClient } from "@/utils/bricklink.ts";
import {
  deleteShippingMethodEnrichment,
  getShippingMethodsCache,
  listShippingMethodEnrichments,
  saveShippingMethodsCache,
} from "@/utils/kv.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "shipping-methods"]);
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ENRICHMENT: ShippingMethodEnrichment = { hasTracking: false };

export async function getShippingMethodsWithEnrichment(client: BricklinkClient): Promise<ShippingMethod[]> {
  const now = Date.now();
  let methods: BLShippingMethod[];

  const cached = await getShippingMethodsCache();
  const cacheAge = cached ? now - new Date(cached.fetchedAt).getTime() : Infinity;

  if (!cached || cacheAge > CACHE_TTL_MS) {
    logger.debug`Shipping methods cache miss or stale — fetching from BrickLink`;
    methods = await client.getShippingMethods();

    if (cached) {
      const previousById = new Map(cached.methods.map((m) => [m.method_id, m]));
      const currentIds = new Set(methods.map((m) => m.method_id));

      for (const [id, prev] of previousById) {
        if (!currentIds.has(id)) {
          logger.debug`Clearing enrichment for removed method_id=${id}`;
          await deleteShippingMethodEnrichment(id);
        } else {
          const current = methods.find((m) => m.method_id === id)!;
          if (current.name !== prev.name) {
            logger.debug`Clearing enrichment for renamed method_id=${id} ("${prev.name}" → "${current.name}")`;
            await deleteShippingMethodEnrichment(id);
          }
        }
      }
    }

    await saveShippingMethodsCache({ methods, fetchedAt: new Date().toISOString() });
  } else {
    logger.debug`Using cached shipping methods (age=${Math.round(cacheAge / 1000)}s)`;
    methods = cached.methods;
  }

  const enrichments = await listShippingMethodEnrichments();

  return methods.map((m) => ({
    ...m,
    enrichment: enrichments.get(m.method_id) ?? DEFAULT_ENRICHMENT,
  }));
}
