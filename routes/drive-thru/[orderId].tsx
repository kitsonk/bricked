import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, getDriveThruSent, listDriveThruTemplates } from "@/utils/kv.ts";
import type { BLOrder, DriveThruSentRecord, DriveThruTemplate } from "@/utils/types.ts";
import { formatAmount } from "@/utils/format.ts";
import DriveThruSend from "@/islands/DriveThruSend.tsx";

export const handler = define.handlers<{
  order: BLOrder | null;
  templates: DriveThruTemplate[];
  sentRecord: DriveThruSentRecord | null;
  error: string | null;
}>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/settings");
    }

    const orderId = Number(ctx.params.orderId);
    if (isNaN(orderId)) {
      return page({ order: null, templates: [], sentRecord: null, error: "Invalid order ID" });
    }

    try {
      const client = new BricklinkClient(creds);
      const [order, templates, sentRecord] = await Promise.all([
        client.getOrder(orderId),
        listDriveThruTemplates(),
        getDriveThruSent(orderId),
      ]);
      return page({ order, templates, sentRecord, error: null });
    } catch (err) {
      return page({ order: null, templates: [], sentRecord: null, error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function DriveThruPage({ data }) {
  const { order, templates, sentRecord, error } = data;

  return (
    <AppFrame>
      <div class="p-6 max-w-2xl">
        <div class="flex items-center gap-3 mb-6">
          <a href="/orders" class="btn btn-ghost btn-sm btn-circle">
            <span class="iconify lucide--arrow-left size-4"></span>
          </a>
          <div>
            <h1 class="text-2xl font-bold">Drive Thru</h1>
            {order && (
              <p class="text-sm text-base-content/60">
                Order{" "}
                <a href={`/orders/${order.order_id}`} class="link font-mono">
                  #{order.order_id}
                </a>{" "}
                — {order.buyer_name}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" class="alert alert-error mb-6">
            <span class="iconify lucide--alert-circle size-5"></span>
            <div>{error}</div>
          </div>
        )}

        {order && (
          <>
            <div class="card bg-base-200 mb-6">
              <div class="card-body py-4">
                <div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
                  <span class="text-base-content/60">Buyer</span>
                  <span class="font-medium">{order.buyer_name}</span>
                  <span class="text-base-content/60">Email</span>
                  <span>{order.buyer_email}</span>
                  <span class="text-base-content/60">Ordered</span>
                  <span>{new Date(order.date_ordered).toLocaleDateString()}</span>
                  <span class="text-base-content/60">Total</span>
                  <span>{order.disp_cost.currency_code} {formatAmount(order.disp_cost.grand_total)}</span>
                  <span class="text-base-content/60">Items</span>
                  <span>{order.total_count} ({order.unique_count} lots)</span>
                </div>
              </div>
            </div>

            <DriveThruSend order={order} templates={templates} sentRecord={sentRecord} />
          </>
        )}
      </div>
    </AppFrame>
  );
});
