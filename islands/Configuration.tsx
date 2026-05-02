import { useSignal } from "@preact/signals";
import type { AusPostAddress } from "@/utils/types.ts";

interface ConfigurationProps {
  initialAddress: AusPostAddress | null;
}

export default function Configuration({ initialAddress }: ConfigurationProps) {
  const recipientName = useSignal(initialAddress?.recipientName ?? "");
  const addressLine1 = useSignal(initialAddress?.addressLine1 ?? "");
  const addressLine2 = useSignal(initialAddress?.addressLine2 ?? "");
  const addressLine3 = useSignal(initialAddress?.addressLine3 ?? "");
  const suburb = useSignal(initialAddress?.suburb ?? "");
  const state = useSignal(initialAddress?.state ?? "");
  const postcode = useSignal(initialAddress?.postcode ?? "");

  const saving = useSignal(false);
  const success = useSignal(false);
  const error = useSignal<string | null>(null);

  async function save(e: Event) {
    e.preventDefault();
    saving.value = true;
    success.value = false;
    error.value = null;

    const body: AusPostAddress = {
      recipientName: recipientName.value.trim(),
      addressLine1: addressLine1.value.trim(),
      addressLine2: addressLine2.value.trim(),
      addressLine3: addressLine3.value.trim(),
      suburb: suburb.value.trim(),
      state: state.value.trim(),
      postcode: postcode.value.trim(),
    };

    try {
      const resp = await fetch("/api/configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      success.value = true;
    } catch (err) {
      error.value = String(err);
    } finally {
      saving.value = false;
    }
  }

  return (
    <div>
      {error.value && (
        <div role="alert" class="alert alert-error mb-4">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{error.value}</div>
        </div>
      )}

      {success.value && (
        <div role="alert" class="alert alert-success mb-4">
          <span class="iconify lucide--check-circle size-5"></span>
          <div>Sender address saved successfully.</div>
        </div>
      )}

      <div class="card bg-base-200 max-w-lg">
        <div class="card-body">
          <h2 class="card-title text-lg">Sender Address</h2>
          <p class="text-sm text-base-content/60 mb-4">
            This address is used as the return address on shipping labels.
          </p>
          <form onSubmit={save}>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Recipient Name</legend>
              <input
                type="text"
                class="input w-full"
                placeholder="Your Name"
                required
                value={recipientName.value}
                onInput={(e) => (recipientName.value = e.currentTarget.value)}
              />
            </fieldset>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Address Line 1</legend>
              <input
                type="text"
                class="input w-full"
                placeholder="123 Example St"
                required
                value={addressLine1.value}
                onInput={(e) => (addressLine1.value = e.currentTarget.value)}
              />
            </fieldset>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Address Line 2</legend>
              <input
                type="text"
                class="input w-full"
                placeholder=""
                value={addressLine2.value}
                onInput={(e) => (addressLine2.value = e.currentTarget.value)}
              />
            </fieldset>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Address Line 3</legend>
              <input
                type="text"
                class="input w-full"
                placeholder=""
                value={addressLine3.value}
                onInput={(e) => (addressLine3.value = e.currentTarget.value)}
              />
            </fieldset>
            <div class="grid grid-cols-3 gap-3 mb-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Suburb</legend>
                <input
                  type="text"
                  class="input w-full"
                  placeholder="Suburb"
                  required
                  value={suburb.value}
                  onInput={(e) => (suburb.value = e.currentTarget.value)}
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">State</legend>
                <input
                  type="text"
                  class="input w-full"
                  placeholder="State"
                  required
                  value={state.value}
                  onInput={(e) => (state.value = e.currentTarget.value)}
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Postcode</legend>
                <input
                  type="text"
                  class="input w-full"
                  placeholder="0000"
                  required
                  value={postcode.value}
                  onInput={(e) => (postcode.value = e.currentTarget.value)}
                />
              </fieldset>
            </div>
            <div class="card-actions justify-end">
              <button type="submit" class="btn btn-primary" disabled={saving.value}>
                {saving.value && <span class="loading loading-spinner loading-xs"></span>}
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
