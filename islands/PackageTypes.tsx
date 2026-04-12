import { useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { PackageType } from "@/utils/types.ts";

export default function PackageTypes({ initialItems }: { initialItems: PackageType[] }) {
  const items = useSignal<PackageType[]>(initialItems);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editingId = useSignal<string | null>(null);
  const formLabel = useSignal("");
  const formLength = useSignal("");
  const formWidth = useSignal("");
  const formHeight = useSignal("");
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);

  function openNew() {
    editingId.value = null;
    formLabel.value = "";
    formLength.value = "";
    formWidth.value = "";
    formHeight.value = "";
    error.value = null;
    dialogRef.current?.showModal();
  }

  function openEdit(item: PackageType) {
    editingId.value = item.id;
    formLabel.value = item.label;
    formLength.value = item.lengthCm.toFixed(1);
    formWidth.value = item.widthCm.toFixed(1);
    formHeight.value = item.heightCm.toFixed(1);
    error.value = null;
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function save(e: Event) {
    e.preventDefault();
    saving.value = true;
    error.value = null;
    const body = {
      label: formLabel.value.trim(),
      lengthCm: parseFloat(formLength.value),
      widthCm: parseFloat(formWidth.value),
      heightCm: parseFloat(formHeight.value),
    };
    try {
      const isNew = editingId.value === null;
      const url = isNew ? "/api/package-types" : `/api/package-types/${editingId.value}`;
      const resp = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      if (isNew) {
        items.value = [...items.value, json].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      } else {
        items.value = items.value.map((item) => item.id === editingId.value ? json : item);
      }
      closeDialog();
    } catch (err) {
      error.value = String(err);
    } finally {
      saving.value = false;
    }
  }

  async function remove(item: PackageType) {
    if (!confirm(`Delete "${item.label}"?`)) return;
    error.value = null;
    try {
      const resp = await fetch(`/api/package-types/${item.id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      items.value = items.value.filter((i) => i.id !== item.id);
    } catch (err) {
      error.value = String(err);
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

      <div class="flex justify-end mb-4">
        <button type="button" class="btn btn-primary btn-sm" onClick={openNew}>
          <span class="iconify lucide--plus size-4"></span>
          Add Package Type
        </button>
      </div>

      {items.value.length === 0
        ? (
          <div class="text-center py-16 text-base-content/50">
            <span class="iconify lucide--package size-12 block mx-auto mb-3"></span>
            <p class="font-medium">No package types</p>
            <p class="text-sm mt-1">Add a package type to get started.</p>
          </div>
        )
        : (
          <div class="overflow-x-auto rounded-box border border-base-content/10">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Label</th>
                  <th class="text-right">Length (cm)</th>
                  <th class="text-right">Width (cm)</th>
                  <th class="text-right">Height (cm)</th>
                  <th class="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {items.value.map((item) => (
                  <tr key={item.id}>
                    <td class="font-medium">{item.label}</td>
                    <td class="text-right text-sm font-mono">{item.lengthCm.toFixed(1)}</td>
                    <td class="text-right text-sm font-mono">{item.widthCm.toFixed(1)}</td>
                    <td class="text-right text-sm font-mono">{item.heightCm.toFixed(1)}</td>
                    <td>
                      <div class="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs btn-square"
                          title="Edit"
                          onClick={() => openEdit(item)}
                        >
                          <span class="iconify lucide--pencil size-3.5"></span>
                        </button>
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs btn-square text-error"
                          title="Delete"
                          onClick={() => remove(item)}
                        >
                          <span class="iconify lucide--trash-2 size-3.5"></span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <dialog ref={dialogRef} class="modal">
        <div class="modal-box">
          <h3 class="text-lg font-bold mb-4">{editingId.value ? "Edit Package Type" : "Add Package Type"}</h3>
          <form onSubmit={save}>
            <fieldset class="fieldset mb-3">
              <legend class="fieldset-legend">Label</legend>
              <input
                type="text"
                class="input w-full"
                placeholder="Small box"
                required
                value={formLabel.value}
                onInput={(e) => (formLabel.value = e.currentTarget.value)}
              />
            </fieldset>
            <div class="grid grid-cols-3 gap-3 mb-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Length (cm)</legend>
                <input
                  type="number"
                  class="input w-full"
                  placeholder="0.0"
                  required
                  min="0.1"
                  step="0.1"
                  value={formLength.value}
                  onInput={(e) => (formLength.value = e.currentTarget.value)}
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Width (cm)</legend>
                <input
                  type="number"
                  class="input w-full"
                  placeholder="0.0"
                  required
                  min="0.1"
                  step="0.1"
                  value={formWidth.value}
                  onInput={(e) => (formWidth.value = e.currentTarget.value)}
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Height (cm)</legend>
                <input
                  type="number"
                  class="input w-full"
                  placeholder="0.0"
                  required
                  min="0.1"
                  step="0.1"
                  value={formHeight.value}
                  onInput={(e) => (formHeight.value = e.currentTarget.value)}
                />
              </fieldset>
            </div>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" onClick={closeDialog}>Cancel</button>
              <button type="submit" class="btn btn-primary" disabled={saving.value}>
                {saving.value && <span class="loading loading-spinner loading-xs"></span>}
                Save
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  );
}
