import { useSignal } from "@preact/signals";

interface ImportResult {
  count: number;
  skipped: number;
  errors: number;
  aborted?: true;
}

export default function RestoreBackup() {
  const selected = useSignal<File | null>(null);
  const overwrite = useSignal(false);
  const importing = useSignal(false);
  const result = useSignal<ImportResult | null>(null);
  const error = useSignal<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    const file = selected.value;
    if (!file) {
      error.value = "Choose a .ndjson export to import.";
      return;
    }

    importing.value = true;
    result.value = null;
    error.value = null;

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("overwrite", overwrite.value ? "true" : "false");
      const resp = await fetch("/api/admin/restore", { method: "POST", body });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      result.value = json as ImportResult;
    } catch (err) {
      error.value = String(err);
    } finally {
      importing.value = false;
    }
  }

  return (
    <div class="max-w-2xl">
      {error.value && (
        <div role="alert" class="alert alert-error mb-4">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{error.value}</div>
        </div>
      )}

      {result.value && (
        <div role="alert" class={`alert mb-4 ${result.value.errors > 0 ? "alert-warning" : "alert-success"}`}>
          <span class="iconify lucide--database-backup size-5"></span>
          <div>
            <p class="font-semibold">{result.value.aborted ? "Import stopped early." : "Import complete."}</p>
            <p class="text-sm">
              Processed {result.value.count} entries · skipped {result.value.skipped} existing · {result.value.errors}{" "}
              failed.
            </p>
          </div>
        </div>
      )}

      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title text-lg">Import NDJSON Export</h2>
          <p class="text-sm text-base-content/60 mb-4">
            Upload a newline-delimited JSON export produced by{" "}
            <code>deno run -A --unstable-kv scripts/kv-export.ts</code>. Every entry in the file is written to this
            store.
          </p>
          <form onSubmit={submit}>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Backup File</legend>
              <input
                type="file"
                class="file-input w-full"
                accept=".ndjson,.jsonl,application/x-ndjson"
                onChange={(e) => (selected.value = e.currentTarget.files?.[0] ?? null)}
              />
            </fieldset>

            <label class="label cursor-pointer justify-start gap-3 mb-1">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                checked={overwrite.value}
                onChange={(e) => (overwrite.value = e.currentTarget.checked)}
              />
              <span class="label-text">Overwrite existing keys</span>
            </label>
            <p class="text-xs text-base-content/50 mb-4">
              Off by default: entries whose key already exists are skipped. On, the imported value replaces whatever is
              in the store.
            </p>

            <div class="card-actions">
              <button type="submit" class="btn btn-primary" disabled={importing.value}>
                {importing.value ? (
                  <>
                    <span class="loading loading-spinner loading-sm"></span>
                    Importing…
                  </>
                ) : (
                  <>
                    <span class="iconify lucide--upload size-4"></span>
                    Import
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
