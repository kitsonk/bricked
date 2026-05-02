import { page } from "fresh";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, getSenderAddress, getShipListAddress } from "@/utils/kv.ts";
import type { AusPostAddress, BLOrder } from "@/utils/types.ts";
import PrintButton from "@/islands/PrintButton.tsx";

function deriveAddress(order: BLOrder): AusPostAddress {
  const addr = order.shipping?.address;
  return {
    recipientName: addr?.name.full || [addr?.name.first, addr?.name.last].filter(Boolean).join(" ") || "",
    addressLine1: addr?.address1 || "",
    addressLine2: addr?.address2 || "",
    addressLine3: "",
    suburb: addr?.city || "",
    state: addr?.state || "",
    postcode: addr?.postal_code || "",
  };
}

function formatAddress(addr: AusPostAddress): string[] {
  const lines: string[] = [];
  if (addr.recipientName) lines.push(addr.recipientName);
  if (addr.addressLine1) lines.push(addr.addressLine1);
  if (addr.addressLine2) lines.push(addr.addressLine2);
  if (addr.addressLine3) lines.push(addr.addressLine3);
  const lastLine = [addr.suburb, addr.state, addr.postcode].filter(Boolean).join(" ");
  if (lastLine) lines.push(lastLine);
  return lines;
}

export const handler = define.handlers<{
  orders: BLOrder[];
  addresses: Record<number, AusPostAddress>;
  sender: AusPostAddress | null;
  error: string | null;
}>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) return ctx.redirect("/environment");

    const orderParam = ctx.url.searchParams.get("orders") ?? "";
    const orderIds = orderParam
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    if (orderIds.length === 0) return ctx.redirect("/orders");

    try {
      const client = new BricklinkClient(creds);
      const [orders, savedAddresses, sender] = await Promise.all([
        Promise.all(orderIds.map((id) => client.get<BLOrder>(`/orders/${id}`))),
        Promise.all(orderIds.map((id) => getShipListAddress(id))),
        getSenderAddress(),
      ]);

      const addresses: Record<number, AusPostAddress> = {};
      orders.forEach((order, idx) => {
        addresses[order.order_id] = savedAddresses[idx] ?? deriveAddress(order);
      });

      return page({ orders, addresses, sender, error: null });
    } catch (err) {
      return page({ orders: [], addresses: {}, sender: null, error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function PrintLabelsPage({ data }) {
  const { orders, addresses, sender, error } = data;

  return (
    <div class="min-h-screen bg-base-200 print:bg-white">
      <div class="no-print sticky top-0 z-50 p-4 flex items-center justify-between bg-base-200/90 backdrop-blur border-b border-base-300">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-bold">Shipping Labels</h1>
          <span class="badge badge-sm badge-ghost">{orders.length} label{orders.length === 1 ? "" : "s"}</span>
        </div>
        <div class="flex items-center gap-3">
          <a href="/ship-list" class="btn btn-ghost btn-sm">
            <span class="iconify lucide--arrow-left size-4"></span>
            Back
          </a>
          <PrintButton />
        </div>
      </div>

      <div class="p-4 space-y-4 max-w-[4in] mx-auto">
        {error && (
          <div role="alert" class="alert alert-error no-print">
            <span class="iconify lucide--alert-circle size-5"></span>
            <span>{error}</span>
          </div>
        )}

        {!error && !sender && (
          <div role="alert" class="alert alert-warning no-print">
            <span class="iconify lucide--alert-triangle size-5"></span>
            <div>
              <div class="font-medium">Sender address not configured</div>
              <div class="text-sm">
                Set the sender address in <a href="/configuration" class="link font-medium">Configuration</a>{" "}
                to add a return address to labels.
              </div>
            </div>
          </div>
        )}

        {orders.map((order) => {
          const toLines = formatAddress(addresses[order.order_id]);
          const fromLines = sender ? formatAddress(sender) : [];
          return (
            <div
              key={order.order_id}
              class="label-page relative flex flex-col bg-white box-border shadow-sm border border-gray-300 rounded-lg print:rounded-none print:border-none print:shadow-none"
            >
              <div class="shrink-0 flex justify-between items-start gap-2">
                <div>
                  {fromLines.length > 0
                    ? (
                      <div class="text-xs text-gray-700 print:text-black space-y-0.5">
                        <div class="font-semibold text-gray-500 print:text-black uppercase tracking-wider text-[10px] mb-1">
                          From
                        </div>
                        {fromLines.map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    )
                    : <div class="text-xs text-gray-400 print:text-black italic">No return address configured</div>}
                </div>
                <img
                  src="/images/bayside-bricks.jpeg"
                  alt="Bayside Bricks"
                  class="h-16 w-auto object-contain shrink-0"
                />
              </div>

              <div class="flex-1 flex flex-col justify-center">
                <div class="text-[10px] font-semibold text-gray-500 print:text-black uppercase tracking-wider mb-2">
                  Ship To
                </div>
                <div class="text-gray-900 print:text-black leading-relaxed space-y-0.5">
                  {toLines.map((line, i) => (
                    <div key={i} class={i === 0 ? "font-bold text-2xl" : "text-lg"}>{line}</div>
                  ))}
                </div>
              </div>

              <div class="shrink-0 pt-2 border-t border-gray-200 print:border-black">
                <div class="text-xs text-gray-500 print:text-black font-mono">
                  Order #{order.order_id}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
