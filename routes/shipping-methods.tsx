import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials } from "@/utils/kv.ts";
import { getShippingMethodsWithEnrichment } from "@/utils/shipping-methods.ts";
import type { ShippingMethod } from "@/utils/types.ts";
import ShippingMethods from "@/islands/ShippingMethods.tsx";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "routes", "shipping-methods"]);

export type ShippingMethodsData = { methods: ShippingMethod[]; error: string | null };

export const handler = define.handlers<ShippingMethodsData>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/environment");
    }
    try {
      const client = new BricklinkClient(creds);
      const methods = await getShippingMethodsWithEnrichment(client);
      logger.debug`Loaded ${methods.length} shipping method(s)`;
      return page({ methods, error: null });
    } catch (err) {
      logger.error`Failed to load shipping methods: ${err}`;
      return page({ methods: [], error: String(err) });
    }
  },
});

export function ShippingMethodsContent({ data }: { data: ShippingMethodsData }) {
  return (
    <div>
      <h1 class="text-2xl font-bold mb-6">Shipping Methods</h1>
      {data.error && (
        <div role="alert" class="alert alert-error mb-6">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>
            <div class="font-medium">Failed to load shipping methods</div>
            <div class="text-sm">{data.error}</div>
          </div>
        </div>
      )}
      <ShippingMethods initialMethods={data.methods} />
    </div>
  );
}

export default define.page<typeof handler>(function ShippingMethodsPage({ data }) {
  return (
    <AppFrame>
      <ShippingMethodsContent data={data} />
    </AppFrame>
  );
});
