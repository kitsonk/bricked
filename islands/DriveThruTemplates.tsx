import { useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { DriveThruTemplate } from "@/utils/types.ts";
import { TEMPLATE_VARIABLES } from "@/utils/drive-thru.ts";

export default function DriveThruTemplates({ initialTemplates }: { initialTemplates: DriveThruTemplate[] }) {
  const templates = useSignal<DriveThruTemplate[]>(initialTemplates);
  const editingId = useSignal<string | null>(null);
  const isNew = useSignal(false);
  const saving = useSignal(false);
  const deleting = useSignal<string | null>(null);
  const modalError = useSignal<string | null>(null);
  const listError = useSignal<string | null>(null);
  const formName = useSignal("");
  const formBody = useSignal("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(variable: string) {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? formBody.value.length;
      const end = textarea.selectionEnd ?? formBody.value.length;
      formBody.value = formBody.value.slice(0, start) + variable + formBody.value.slice(end);
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = start + variable.length;
        textarea.setSelectionRange(newPos, newPos);
      });
    } else {
      formBody.value += variable;
    }
  }

  function openNew() {
    isNew.value = true;
    editingId.value = null;
    formName.value = "";
    formBody.value = "";
    modalError.value = null;
    dialogRef.current?.showModal();
  }

  function openEdit(t: DriveThruTemplate) {
    isNew.value = false;
    editingId.value = t.id;
    formName.value = t.name;
    formBody.value = t.body;
    modalError.value = null;
    dialogRef.current?.showModal();
  }

  async function save() {
    if (!formName.value.trim() || !formBody.value.trim()) {
      modalError.value = "Name and body are required.";
      return;
    }
    saving.value = true;
    modalError.value = null;
    try {
      const creating = isNew.value;
      const url = creating ? "/api/drive-thru/templates" : `/api/drive-thru/templates/${editingId.value}`;
      const resp = await fetch(url, {
        method: creating ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.value.trim(), body: formBody.value }),
      });
      const saved = await resp.json();
      if (!resp.ok) throw new Error((saved as { error?: string }).error ?? `HTTP ${resp.status}`);
      const saved_ = saved as DriveThruTemplate;
      templates.value = creating
        ? [...templates.value, saved_]
        : templates.value.map((t) => (t.id === saved_.id ? saved_ : t));
      dialogRef.current?.close();
    } catch (err) {
      modalError.value = String(err);
    } finally {
      saving.value = false;
    }
  }

  async function deleteTemplate(id: string) {
    deleting.value = id;
    listError.value = null;
    try {
      const resp = await fetch(`/api/drive-thru/templates/${id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      templates.value = templates.value.filter((t) => t.id !== id);
    } catch (err) {
      listError.value = String(err);
    } finally {
      deleting.value = null;
    }
  }

  return (
    <div>
      {listError.value && (
        <div role="alert" class="alert alert-error mb-4">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{listError.value}</div>
        </div>
      )}

      {templates.value.length === 0
        ? (
          <div class="text-center py-12 text-base-content/50 mb-6">
            <span class="iconify lucide--file-text size-12 block mx-auto mb-3"></span>
            <p class="font-medium">No templates yet</p>
            <p class="text-sm mt-1">Create a template to use when sending Drive Thru messages.</p>
          </div>
        )
        : (
          <div class="space-y-3 mb-6">
            {templates.value.map((t) => (
              <div key={t.id} class="card bg-base-200">
                <div class="card-body py-3 px-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="font-medium">{t.name}</div>
                      <div class="text-sm text-base-content/60 mt-1 line-clamp-2 whitespace-pre-wrap">{t.body}</div>
                    </div>
                    <div class="flex gap-1 shrink-0">
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-square"
                        onClick={() => openEdit(t)}
                        aria-label="Edit template"
                      >
                        <span class="iconify lucide--pencil size-4"></span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-square text-error"
                        disabled={deleting.value === t.id}
                        onClick={() => deleteTemplate(t.id)}
                        aria-label="Delete template"
                      >
                        {deleting.value === t.id
                          ? <span class="loading loading-spinner loading-xs"></span>
                          : <span class="iconify lucide--trash-2 size-4"></span>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      <button type="button" class="btn btn-primary" onClick={openNew}>
        <span class="iconify lucide--plus size-4"></span>
        New Template
      </button>

      {/* Create / edit modal */}
      <dialog ref={dialogRef} class="modal">
        <div class="modal-box">
          <form method="dialog">
            <button type="submit" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 class="text-lg font-bold mb-4">{isNew.value ? "New Template" : "Edit Template"}</h3>

          {modalError.value && (
            <div role="alert" class="alert alert-error mb-4">
              <span class="iconify lucide--alert-circle size-5"></span>
              <div class="text-sm">{modalError.value}</div>
            </div>
          )}

          <fieldset class="fieldset mb-3">
            <legend class="fieldset-legend">Name</legend>
            <input
              type="text"
              class="input w-full"
              placeholder="e.g. Welcome Message"
              value={formName.value}
              onInput={(e) => (formName.value = e.currentTarget.value)}
            />
          </fieldset>

          <fieldset class="fieldset mb-3">
            <legend class="fieldset-legend">Message Body</legend>
            <textarea
              ref={textareaRef}
              class="textarea w-full h-40"
              placeholder="Hi {{buyer_name}}, thank you for your order #{{order_id}}!"
              value={formBody.value}
              onInput={(e) => (formBody.value = e.currentTarget.value)}
            />
            <p class="label text-xs flex flex-wrap gap-x-1">
              <span class="text-base-content/60">Variables:</span>
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.variable}
                  type="button"
                  title={v.description}
                  class="cursor-pointer"
                  onClick={() => insertVariable(v.variable)}
                >
                  <code class="text-primary hover:text-primary/70">{v.variable}</code>
                </button>
              ))}
            </p>
          </fieldset>

          <div class="modal-action">
            <form method="dialog">
              <button type="submit" class="btn btn-ghost">Cancel</button>
            </form>
            <button type="button" class="btn btn-primary" disabled={saving.value} onClick={save}>
              {saving.value && <span class="loading loading-spinner loading-sm"></span>}
              Save
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      {/* Variable reference table */}
      <div class="mt-10">
        <h2 class="text-sm font-semibold text-base-content/60 mb-2 uppercase tracking-wide">Template Variables</h2>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_VARIABLES.map((v) => (
                <tr key={v.variable}>
                  <td>
                    <code class="text-primary">{v.variable}</code>
                  </td>
                  <td class="text-sm text-base-content/70">{v.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
