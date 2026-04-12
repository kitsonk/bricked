import { type TargetedEvent } from "preact";
import { useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { Customer } from "@/utils/types.ts";
import type { ImportResult } from "@/routes/api/crm/import.ts";
import { formatAmount, humanTime } from "@/utils/format.ts";

interface Props {
  initialCustomers: Customer[];
  nextCursor: string | null;
  currentCursor: string | null;
  history: string[];
  buyerFilter: string | null;
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
  { initialCustomers, nextCursor, currentCursor, history, buyerFilter, lastRefreshedAt }: Props,
) {
  const refreshing = useSignal(false);
  const refreshError = useSignal<string | null>(null);

  // Typeahead state
  const buyerQuery = useSignal(buyerFilter ?? "");
  const suggestions = useSignal<string[]>([]);
  const showSuggestions = useSignal(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectBuyer(name: string) {
    showSuggestions.value = false;
    globalThis.location.assign(`/customers?buyer=${encodeURIComponent(name)}`);
  }

  async function onBuyerInput(e: TargetedEvent<HTMLInputElement>) {
    const value = e.currentTarget.value;
    buyerQuery.value = value;
    if (!value) {
      suggestions.value = [];
      showSuggestions.value = false;
      globalThis.location.assign("/customers");
      return;
    }
    try {
      const resp = await fetch(`/api/crm/buyers?q=${encodeURIComponent(value)}`);
      suggestions.value = await resp.json() as string[];
      showSuggestions.value = true;
    } catch {
      suggestions.value = [];
    }
  }

  function onBuyerKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && suggestions.value.length === 1) {
      selectBuyer(suggestions.value[0]);
    } else if (e.key === "Escape") {
      showSuggestions.value = false;
    }
  }

  const importDialogRef = useRef<HTMLDialogElement>(null);
  const importFile = useSignal<File | null>(null);
  const importing = useSignal(false);
  const importResult = useSignal<ImportResult | null>(null);
  const importError = useSignal<string | null>(null);

  const hasPrev = history.length > 0;
  const prevUrl = hasPrev ? pageUrl(history[history.length - 1] || null, history.slice(0, -1)) : null;
  const nextUrl = nextCursor ? pageUrl(nextCursor, [...history, currentCursor ?? ""]) : null;

  async function refresh() {
    refreshing.value = true;
    refreshError.value = null;
    try {
      const resp = await fetch("/api/crm/refresh", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      globalThis.location.assign("/customers");
    } catch (err) {
      refreshError.value = String(err);
      refreshing.value = false;
    }
  }

  function openImport() {
    importFile.value = null;
    importResult.value = null;
    importError.value = null;
    importDialogRef.current?.showModal();
  }

  function closeImport() {
    importDialogRef.current?.close();
  }

  async function submitImport(e: Event) {
    e.preventDefault();
    if (!importFile.value) return;
    importing.value = true;
    importResult.value = null;
    importError.value = null;
    try {
      const fd = new FormData();
      fd.append("file", importFile.value);
      const resp = await fetch("/api/crm/import", { method: "POST", body: fd });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      importResult.value = json as ImportResult;
    } catch (err) {
      importError.value = String(err);
    } finally {
      importing.value = false;
    }
  }

  const isEmpty = initialCustomers.length === 0 && !hasPrev && !buyerFilter;

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
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-primary btn-sm" onClick={openImport}>
            <span class="iconify lucide--upload size-4"></span>
            Import CSV
          </button>
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
      </div>

      {refreshError.value && (
        <div role="alert" class="alert alert-error mb-6">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>
            <div class="font-medium">Refresh failed</div>
            <div class="text-sm">{refreshError.value}</div>
          </div>
        </div>
      )}

      {isEmpty
        ? (
          <div class="border border-base-content/10 rounded-box p-8 text-center text-base-content/50">
            No customer data yet. Click <strong>Update</strong> to build the CRM from your order history.
          </div>
        )
        : (
          <>
            <div class="relative mb-4 max-w-xs">
              <input
                ref={inputRef}
                type="text"
                class="input input-bordered input-sm w-full"
                placeholder="Filter by buyer…"
                value={buyerQuery.value}
                onInput={onBuyerInput}
                onKeyDown={onBuyerKeyDown}
                onFocus={() => {
                  showSuggestions.value = true;
                }}
                onBlur={() => {
                  // Delay hiding so click on a suggestion registers first.
                  setTimeout(() => {
                    showSuggestions.value = false;
                  }, 150);
                }}
              />
              {showSuggestions.value && suggestions.value.length > 0 && (
                <ul class="absolute z-10 mt-1 w-full bg-base-100 border border-base-content/10 rounded-box shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.value.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        class="w-full text-left px-3 py-1.5 text-sm hover:bg-base-200"
                        onMouseDown={() => selectBuyer(name)}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
                  {initialCustomers.length === 0
                    ? (
                      <tr>
                        <td colspan={5} class="text-center text-base-content/50 py-8">No matching customer.</td>
                      </tr>
                    )
                    : initialCustomers.map((c) => (
                      <tr key={c.buyerName}>
                        <td>
                          <a
                            class="link font-medium"
                            href={`/customers/${encodeURIComponent(c.buyerName)}`}
                          >
                            {c.buyerName}
                          </a>
                        </td>
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

            {!buyerFilter && (hasPrev || nextUrl) && (
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

      {/* Import CSV dialog */}
      <dialog ref={importDialogRef} class="modal">
        <div class="modal-box">
          <form method="dialog">
            <button type="submit" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 class="text-lg font-bold mb-4">Import Orders from CSV</h3>

          {!importResult.value
            ? (
              <form onSubmit={submitImport}>
                <p class="text-sm text-base-content/60 mb-4">
                  Upload a CSV file with columns: <code>order_id</code>, <code>buyer_name</code>,{" "}
                  <code>date_ordered</code> (MM/DD/YYYY), <code>value</code> ($0.00).
                </p>
                <input
                  type="file"
                  accept=".csv"
                  class="file-input file-input-bordered w-full mb-4"
                  onChange={(e) => {
                    const files = e.currentTarget.files;
                    importFile.value = files?.[0] ?? null;
                  }}
                  required
                />
                {importError.value && (
                  <div role="alert" class="alert alert-error mb-4">
                    <span class="iconify lucide--alert-circle size-5"></span>
                    <div class="text-sm">{importError.value}</div>
                  </div>
                )}
                <div class="modal-action mt-0">
                  <button type="button" class="btn btn-ghost" onClick={closeImport}>Cancel</button>
                  <button type="submit" class="btn btn-primary" disabled={importing.value || !importFile.value}>
                    {importing.value
                      ? (
                        <>
                          <span class="loading loading-spinner loading-xs"></span>
                          Importing…
                        </>
                      )
                      : "Import"}
                  </button>
                </div>
              </form>
            )
            : (
              <div>
                <div class="flex gap-4 mb-4">
                  <div class="stat bg-success/10 rounded-box p-4 flex-1">
                    <div class="stat-title text-xs">Imported</div>
                    <div class="stat-value text-success text-2xl">{importResult.value.imported}</div>
                  </div>
                  <div class="stat bg-base-200 rounded-box p-4 flex-1">
                    <div class="stat-title text-xs">Skipped</div>
                    <div class="stat-value text-2xl">{importResult.value.skipped}</div>
                  </div>
                  <div class="stat bg-error/10 rounded-box p-4 flex-1">
                    <div class="stat-title text-xs">Errors</div>
                    <div class="stat-value text-error text-2xl">{importResult.value.errors.length}</div>
                  </div>
                </div>
                {importResult.value.errors.length > 0 && (
                  <div class="bg-base-200 rounded-box p-3 max-h-48 overflow-y-auto mb-4">
                    {importResult.value.errors.map((e) => (
                      <p key={e.row} class="text-xs text-error font-mono">
                        Row {e.row}: {e.reason}
                      </p>
                    ))}
                  </div>
                )}
                <div class="modal-action mt-0">
                  <button type="button" class="btn btn-ghost" onClick={closeImport}>Close</button>
                  {importResult.value.imported > 0 && (
                    <a href="/customers" class="btn btn-primary">
                      Refresh Customers
                    </a>
                  )}
                </div>
              </div>
            )}
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  );
}
