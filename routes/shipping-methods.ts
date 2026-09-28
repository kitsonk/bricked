import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials } from "@/utils/kv.ts";
import { getShippingMethodsWithEnrichment } from "@/utils/shipping-methods.ts";
import type { ShippingMethod } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";
import type { PageResult } from "@/routes/pageResult.ts";

const logger = getLogger(["bricked", "routes", "shipping-methods"]);

export type ShippingMethodsData = { methods: ShippingMethod[]; error: string | null };

export async function loadShippingMethods(): Promise<PageResult<ShippingMethodsData>> {
  const creds = getCredentials();
  if (!creds) {
    return { kind: "redirect", to: "/environment" };
  }
  try {
    const client = new BricklinkClient(creds);
    const methods = await getShippingMethodsWithEnrichment(client);
    logger.debug`Loaded ${methods.length} shipping method(s)`;
    return { kind: "data", data: { methods, error: null } };
  } catch (err) {
    logger.error`Failed to load shipping methods: ${err}`;
    return { kind: "data", data: { methods: [], error: String(err) } };
  }
}
