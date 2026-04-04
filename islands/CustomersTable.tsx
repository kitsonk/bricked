import { useSignal } from "@preact/signals";
import type { Customer } from "@/utils/types.ts";
import { formatAmount, humanTime } from "@/utils/format.ts";

interface Props {
  initialCustomers: Customer[];
  nextCursor: string | null;
  currentCursor: string | null;
  history: string[];
  lastRefreshedAt: string | null;
}

/** Build a /customers URL for a given cursor + history stack. */
function pageUrl(cursor: string | null, history: string[]): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  for (const h of history) {
    params.append("history", h);
  }
  const qs = params.toString();
  return qs ? `/customers?${qs}` : "/customers";
}

export default function CustomersTable(
  { initialCustomers, nextCursor, currentCursor, history, lastRefreshedAt }: Props,
) {
  const refreshing = useSignal(false);
  const error = useSignal<string | null>(null);

  const hasPrev = history.length > 0;
  const prevUrl = hasPrev ? pageUrl(history[history.length - 1] || null, history.slice(0, -1)) : null;
  const nextUrl = nextCursor ? pageUrl(nextCursor, [...history, currentCursor ?? ""]) : null;

  async function refresh() {
    refreshing.value = true;
    error.value = null;
    try {
      const resp = await fetch("/api/crm/refresh", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      // Navigate to page 1 so the freshly-built data is shown from the start.
      globalThis.location.assign("/customers");
    } catch (err) {
      error.value = String(err);
      refreshing.value = false;
    }
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Customers</h1>
          {lastRefreshedAt
            ? (
              <p class="text-sm text-base-content/50 mt-0.5">
                Last updated {humanTime(lastRefreshedAt)}
              </p>
            )
            : (
              <p class="text-sm text-base-content/50 mt-0.5">
                Never refreshed — click Update to build the CRM.
              </p>
            )}
        </div>
        <button type="button" class="btn btn-primary btn-sm" onClick={refresh} disabled={refreshing.value}>
          {refreshing.value
            ? (
              <>
                <span class="loading loading-spinner loading-xs"></span>
                Updating…
              </>
            )
            : (
              <>
                <span class="iconify lucide--refresh-cw size-4"></span>
                Update
              </>
            )}
        </button>
      </div>

      {error.value && (
        <div role="alert" class="alert alert-error mb-6">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>
            <div class="font-medium">Refresh failed</div>
            <div class="text-sm">{error.value}</div>
          </div>
        </div>
      )}

      {initialCustomers.length === 0 && !hasPrev
        ? (
          <div class="border border-base-content/10 rounded-box p-8 text-center text-base-content/50">
            No customer data yet. Click <strong>Update</strong> to build the CRM from your order history.
          </div>
        )
        : (
          <>
            <div class="border border-base-content/10 rounded-box overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th class="text-right">Orders</th>
                    <th>First Order</th>
                    <th>Latest Order</th>
                    <th>Total Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {initialCustomers.map((c) => (
                    <tr key={c.buyerName}>
                      <td class="font-medium">{c.buyerName}</td>
                      <td class="text-right tabular-nums">{c.orderCount}</td>
                      <td class="text-sm text-base-content/70">
                        {new Date(c.firstOrderDate).toLocaleDateString()}
                      </td>
                      <td class="text-sm">
                        <span title={new Date(c.lastOrderDate).toLocaleDateString()}>
                          {humanTime(c.lastOrderDate)}
                        </span>
                      </td>
                      <td class="text-sm tabular-nums">
                        {Object.entries(c.totalsByCurrency).map(([currency, total]) => (
                          <div key={currency}>
                            {currency} {formatAmount(total.toFixed(4))}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(hasPrev || nextUrl) && (
              <div class="flex justify-between items-center mt-4">
                <div>
                  {hasPrev && (
                    <a href={prevUrl!} class="btn btn-ghost btn-sm">
                      <span class="iconify lucide--arrow-left size-4"></span>
                      Previous
                    </a>
                  )}
                </div>
                <div>
                  {nextUrl && (
                    <a href={nextUrl} class="btn btn-ghost btn-sm">
                      Next
                      <span class="iconify lucide--arrow-right size-4"></span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
