import { page } from "fresh";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getCredentials, getShipListAddress } from "@/utils/kv.ts";
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

function getSenderAddress(): AusPostAddress | null {
  const raw = Deno.env.get("SENDER_ADDRESS");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AusPostAddress;
  } catch {
    return null;
  }
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
      const [orders, savedAddresses] = await Promise.all([
        Promise.all(orderIds.map((id) => client.get<BLOrder>(`/orders/${id}`))),
        Promise.all(orderIds.map((id) => getShipListAddress(id))),
      ]);

      const addresses: Record<number, AusPostAddress> = {};
      orders.forEach((order, idx) => {
        addresses[order.order_id] = savedAddresses[idx] ?? deriveAddress(order);
      });

      return page({ orders, addresses, sender: getSenderAddress(), error: null });
    } catch (err) {
      return page({ orders: [], addresses: {}, sender: null, error: String(err) });
    }
  },
});

export default define.page<typeof handler>(function PrintLabelsPage({ data }) {
  const { orders, addresses, sender, error } = data;

  return (
    <div class="min-h-screen bg-base-200 print:bg-white">
      <style>
        {`
        @media print {
          @page {
            size: 105mm 148mm;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
          .label-page {
            width: 105mm !important;
            height: 148mm !important;
            padding: 10mm !important;
            border: none !important;
            margin: 0 !important;
            page-break-after: always;
            background: white !important;
            box-shadow: none !important;
          }
          .label-page:last-child {
            page-break-after: auto;
          }
          body {
            background: white !important;
          }
        }
        .label-page {
          width: 105mm;
          height: 148mm;
          padding: 10mm;
          box-sizing: border-box;
          background: white;
          display: flex;
          flex-direction: column;
          position: relative;
        }
      `}
      </style>

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

      <div class="p-4 space-y-4 max-w-[120mm] mx-auto">
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
                Set the <code class="font-mono bg-base-300 px-1 rounded">SENDER_ADDRESS</code>{" "}
                environment variable to add a return address to labels.
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
              class="label-page shadow-sm border border-gray-300 rounded-lg print:rounded-none print:border-none"
            >
              <div class="shrink-0">
                {fromLines.length > 0
                  ? (
                    <div class="text-xs text-gray-700 space-y-0.5">
                      <div class="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-1">
                        From
                      </div>
                      {fromLines.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  )
                  : <div class="text-xs text-gray-400 italic">No return address configured</div>}
              </div>

              <div class="flex-1 flex flex-col justify-center">
                <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Ship To</div>
                <div class="text-gray-900 leading-relaxed space-y-0.5">
                  {toLines.map((line, i) => <div key={i} class={i === 0 ? "font-bold text-lg" : ""}>{line}</div>)}
                </div>
              </div>

              <div class="shrink-0 pt-2 border-t border-gray-200 print:border-gray-200">
                <div class="text-xs text-gray-500 font-mono">
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
