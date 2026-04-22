import { useSignal } from "@preact/signals";
import type { BLColor, ColorsMeta } from "@/utils/types.ts";

export default function Colors(
  { initialColors, initialMeta }: { initialColors: BLColor[]; initialMeta: ColorsMeta | null },
) {
  const colors = useSignal<BLColor[]>(initialColors);
  const meta = useSignal<ColorsMeta | null>(initialMeta);
  const refreshing = useSignal(false);
  const error = useSignal<string | null>(null);

  async function refresh() {
    refreshing.value = true;
    error.value = null;
    try {
      const resp = await fetch("/api/colors/refresh", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      colors.value = json.colors ?? [];
      meta.value = json.meta ?? null;
    } catch (err) {
      error.value = String(err);
    } finally {
      refreshing.value = false;
    }
  }

  return (
    <>
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Colors</h1>
          {meta.value
            ? (
              <p class="text-sm text-base-content/50 mt-1">
                {meta.value.count} colors · Last refreshed {new Date(meta.value.lastRefreshedAt).toLocaleString()}
              </p>
            )
            : <p class="text-sm text-base-content/50 mt-1">Not yet cached</p>}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onClick={refresh} disabled={refreshing.value}>
          {refreshing.value
            ? <span class="loading loading-spinner loading-xs"></span>
            : <span class="iconify lucide--refresh-cw size-4"></span>}
          Refresh
        </button>
      </div>

      {error.value && (
        <div role="alert" class="alert alert-error mb-4">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{error.value}</div>
        </div>
      )}

      {colors.value.length === 0
        ? (
          <div class="text-center py-16 text-base-content/50">
            <span class="iconify lucide--palette size-12 block mx-auto mb-3"></span>
            <p class="font-medium">No colors cached</p>
            <p class="text-sm mt-1">Click Refresh to fetch colors from BrickLink.</p>
          </div>
        )
        : (
          <div class="overflow-x-auto rounded-box border border-base-content/10">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th class="w-10"></th>
                  <th class="text-right">ID</th>
                  <th>Name</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {colors.value.map((color) => (
                  <tr key={color.color_id}>
                    <td>
                      <span
                        class="block size-5 rounded-sm border border-base-content/20"
                        style={{ backgroundColor: color.color_code ? `#${color.color_code}` : "transparent" }}
                      />
                    </td>
                    <td class="text-right font-mono text-sm">{color.color_id}</td>
                    <td class="font-medium">{color.color_name}</td>
                    <td class="text-sm text-base-content/60">{color.color_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
