import { useSignal } from "@preact/signals";
import type { ShippingMethod } from "@/utils/types.ts";

const AREA_LABELS: Record<string, string> = {
  D: "Domestic",
  I: "International",
  B: "Both",
};

export default function ShippingMethods({ initialMethods }: { initialMethods: ShippingMethod[] }) {
  const methods = useSignal<ShippingMethod[]>(initialMethods);
  const saving = useSignal<number | null>(null);
  const error = useSignal<string | null>(null);

  async function toggleTracking(method: ShippingMethod) {
    saving.value = method.method_id;
    error.value = null;
    const newValue = !method.enrichment.hasTracking;
    try {
      const resp = await fetch(`/api/shipping-methods/${method.method_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasTracking: newValue }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      methods.value = methods.value.map((m) =>
        m.method_id === method.method_id ? { ...m, enrichment: { ...m.enrichment, hasTracking: newValue } } : m
      );
    } catch (err) {
      error.value = String(err);
    } finally {
      saving.value = null;
    }
  }

  if (methods.value.length === 0) {
    return (
      <div class="text-center py-16 text-base-content/50">
        <span class="iconify lucide--truck size-12 block mx-auto mb-3"></span>
        <p class="font-medium">No shipping methods found</p>
      </div>
    );
  }

  return (
    <div>
      {error.value && (
        <div role="alert" class="alert alert-error mb-4">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{error.value}</div>
        </div>
      )}
      <div class="overflow-x-auto rounded-box border border-base-content/10">
        <table class="table table-sm">
          <thead>
            <tr>
              <th class="w-1/2">Name</th>
              <th>Area</th>
              <th>Note</th>
              <th class="text-center">Has Tracking</th>
            </tr>
          </thead>
          <tbody>
            {methods.value.map((m) => (
              <tr key={m.method_id}>
                <td>
                  <div class="font-medium">
                    {m.name}
                    {m.is_default && <span class="badge badge-xs badge-ghost ml-2">default</span>}
                  </div>
                  <div class="text-xs text-base-content/40 font-mono">#{m.method_id}</div>
                </td>
                <td class="text-sm">{AREA_LABELS[m.area] ?? m.area}</td>
                <td class="text-sm text-base-content/60">{m.note || "—"}</td>
                <td class="text-center">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={m.enrichment.hasTracking}
                    disabled={saving.value === m.method_id}
                    onChange={() => toggleTracking(m)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
