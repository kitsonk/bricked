import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { DriveThruTemplate, RuleCondition, RuleField, RuleOperator, TemplateRule } from "@/utils/types.ts";

const FIELD_LABELS: Record<RuleField, string> = {
  customer_order_count: "Customer order count",
  shipping_method: "Shipping method",
  shipping_method_id: "Shipping method ID",
  order_total: "Order total",
  item_count: "Item count",
  country_code: "Country code",
  status: "Order status",
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  eq: "equals",
  ne: "does not equal",
  gt: "greater than",
  gte: "greater than or equal",
  lt: "less than",
  lte: "less than or equal",
  contains: "contains",
};

const FIELDS: RuleField[] = [
  "customer_order_count",
  "shipping_method",
  "shipping_method_id",
  "order_total",
  "item_count",
  "country_code",
  "status",
];

const OPERATORS: RuleOperator[] = ["eq", "ne", "gt", "gte", "lt", "lte", "contains"];

function emptyCondition(): RuleCondition {
  return { field: "customer_order_count", operator: "gt", value: "" };
}

export default function DriveThruRules({
  initialRules,
  templates,
}: {
  initialRules: TemplateRule[];
  templates: DriveThruTemplate[];
}) {
  const rules = useSignal<TemplateRule[]>(initialRules);
  const defaultTemplateId = useSignal<string | null>(null);
  const editingId = useSignal<string | null>(null);
  const isNew = useSignal(false);
  const saving = useSignal(false);
  const deleting = useSignal<string | null>(null);
  const modalError = useSignal<string | null>(null);
  const listError = useSignal<string | null>(null);
  const formName = useSignal("");
  const formTemplateId = useSignal("");
  const formConditions = useSignal<RuleCondition[]>([emptyCondition()]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Load default template ID on mount
  useEffect(() => {
    fetch("/api/drive-thru/rules/default")
      .then((r) => r.json())
      .then((d) => {
        defaultTemplateId.value = d.defaultTemplateId ?? null;
      })
      .catch(() => {
        // ignore
      });
  }, []);

  function openNew() {
    isNew.value = true;
    editingId.value = null;
    formName.value = "";
    formTemplateId.value = templates[0]?.id ?? "";
    formConditions.value = [emptyCondition()];
    modalError.value = null;
    dialogRef.current?.showModal();
  }

  function openEdit(rule: TemplateRule) {
    isNew.value = false;
    editingId.value = rule.id;
    formName.value = rule.name;
    formTemplateId.value = rule.templateId;
    formConditions.value = rule.conditions.length > 0 ? [...rule.conditions] : [emptyCondition()];
    modalError.value = null;
    dialogRef.current?.showModal();
  }

  async function saveDefault(id: string) {
    try {
      const resp = await fetch("/api/drive-thru/rules/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultTemplateId: id }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      defaultTemplateId.value = id;
    } catch (err) {
      listError.value = String(err);
    }
  }

  async function save() {
    if (!formName.value.trim() || !formTemplateId.value.trim()) {
      modalError.value = "Name and template are required.";
      return;
    }
    const cleanedConditions = formConditions.value.filter((c) => String(c.value).trim() !== "");
    if (cleanedConditions.length === 0) {
      modalError.value = "At least one condition is required.";
      return;
    }
    saving.value = true;
    modalError.value = null;
    try {
      const creating = isNew.value;
      const url = creating ? "/api/drive-thru/rules" : `/api/drive-thru/rules/${editingId.value}`;
      const maxPriority = rules.value.length > 0 ? Math.max(...rules.value.map((r) => r.priority)) : -1;
      const body = {
        name: formName.value.trim(),
        templateId: formTemplateId.value.trim(),
        conditions: cleanedConditions,
        priority: creating ? maxPriority + 1 : rules.value.find((r) => r.id === editingId.value)?.priority ?? 0,
      };
      const resp = await fetch(url, {
        method: creating ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const saved = await resp.json();
      if (!resp.ok) throw new Error((saved as { error?: string }).error ?? `HTTP ${resp.status}`);
      const saved_ = saved as TemplateRule;
      rules.value = creating
        ? [...rules.value, saved_].sort((a, b) => a.priority - b.priority)
        : rules.value.map((r) => (r.id === saved_.id ? saved_ : r)).sort((a, b) => a.priority - b.priority);
      dialogRef.current?.close();
    } catch (err) {
      modalError.value = String(err);
    } finally {
      saving.value = false;
    }
  }

  async function deleteRule(id: string) {
    deleting.value = id;
    listError.value = null;
    try {
      const resp = await fetch(`/api/drive-thru/rules/${id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      rules.value = rules.value.filter((r) => r.id !== id);
    } catch (err) {
      listError.value = String(err);
    } finally {
      deleting.value = null;
    }
  }

  async function moveRule(id: string, direction: "up" | "down") {
    const idx = rules.value.findIndex((r) => r.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === rules.value.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const updated = rules.value.map((r, i) => {
      if (i === idx) return { ...r, priority: rules.value[swapIdx].priority, updatedAt: new Date().toISOString() };
      if (i === swapIdx) return { ...r, priority: rules.value[idx].priority, updatedAt: new Date().toISOString() };
      return r;
    });

    try {
      await Promise.all([
        fetch(`/api/drive-thru/rules/${updated[idx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated[idx]),
        }),
        fetch(`/api/drive-thru/rules/${updated[swapIdx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated[swapIdx]),
        }),
      ]);
      rules.value = updated.sort((a, b) => a.priority - b.priority);
    } catch (err) {
      listError.value = String(err);
    }
  }

  function addCondition() {
    formConditions.value = [...formConditions.value, emptyCondition()];
  }

  function removeCondition(index: number) {
    formConditions.value = formConditions.value.filter((_, i) => i !== index);
    if (formConditions.value.length === 0) {
      formConditions.value = [emptyCondition()];
    }
  }

  function updateCondition(index: number, patch: Partial<RuleCondition>) {
    formConditions.value = formConditions.value.map((c, i) => (i === index ? { ...c, ...patch } : c));
  }

  return (
    <div>
      {listError.value && (
        <div role="alert" class="alert alert-error mb-4">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{listError.value}</div>
        </div>
      )}

      <fieldset class="fieldset mb-6">
        <legend class="fieldset-legend">Default Template</legend>
        <select
          class="select w-full max-w-xs"
          value={defaultTemplateId.value ?? ""}
          onChange={(e) => saveDefault(e.currentTarget.value)}
        >
          <option value="">None (use first template)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p class="label text-xs text-base-content/50">
          The template used when no rules match.
        </p>
      </fieldset>

      {rules.value.length === 0
        ? (
          <div class="text-center py-12 text-base-content/50 mb-6">
            <span class="iconify lucide--file-text size-12 block mx-auto mb-3"></span>
            <p class="font-medium">No rules yet</p>
            <p class="text-sm mt-1">Create a rule to automatically select templates based on order details.</p>
          </div>
        )
        : (
          <div class="space-y-3 mb-6">
            {rules.value.map((rule, index) => (
              <div key={rule.id} class="card bg-base-200">
                <div class="card-body py-3 px-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="font-medium flex items-center gap-2">
                        <span class="badge badge-xs badge-ghost">{index + 1}</span>
                        {rule.name}
                      </div>
                      <div class="text-sm text-base-content/60 mt-1">
                        → {templates.find((t) => t.id === rule.templateId)?.name ?? "Unknown template"}
                      </div>
                      <div class="text-xs text-base-content/50 mt-1">
                        {rule.conditions.map((c) =>
                          `${FIELD_LABELS[c.field]} ${OPERATOR_LABELS[c.operator]} "${c.value}"`
                        ).join(" AND ")}
                      </div>
                    </div>
                    <div class="flex gap-1 shrink-0">
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-square"
                        disabled={index === 0}
                        onClick={() => moveRule(rule.id, "up")}
                        aria-label="Move up"
                      >
                        <span class="iconify lucide--arrow-up size-4"></span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-square"
                        disabled={index === rules.value.length - 1}
                        onClick={() => moveRule(rule.id, "down")}
                        aria-label="Move down"
                      >
                        <span class="iconify lucide--arrow-down size-4"></span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-square"
                        onClick={() => openEdit(rule)}
                        aria-label="Edit rule"
                      >
                        <span class="iconify lucide--pencil size-4"></span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-square text-error"
                        disabled={deleting.value === rule.id}
                        onClick={() => deleteRule(rule.id)}
                        aria-label="Delete rule"
                      >
                        {deleting.value === rule.id
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
        New Rule
      </button>

      {/* Create / edit modal */}
      <dialog ref={dialogRef} class="modal">
        <div class="modal-box max-w-2xl">
          <form method="dialog">
            <button type="submit" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 class="text-lg font-bold mb-4">{isNew.value ? "New Rule" : "Edit Rule"}</h3>

          {modalError.value && (
            <div role="alert" class="alert alert-error mb-4">
              <span class="iconify lucide--alert-circle size-5"></span>
              <div class="text-sm">{modalError.value}</div>
            </div>
          )}

          <fieldset class="fieldset mb-3">
            <legend class="fieldset-legend">Rule Name</legend>
            <input
              type="text"
              class="input w-full"
              placeholder="e.g. Repeat buyer + Pickup"
              value={formName.value}
              onInput={(e) => (formName.value = e.currentTarget.value)}
            />
          </fieldset>

          <fieldset class="fieldset mb-3">
            <legend class="fieldset-legend">Target Template</legend>
            <select
              class="select w-full"
              value={formTemplateId.value}
              onChange={(e) => (formTemplateId.value = e.currentTarget.value)}
            >
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </fieldset>

          <fieldset class="fieldset mb-3">
            <legend class="fieldset-legend">Conditions (all must match)</legend>
            <div class="space-y-2">
              {formConditions.value.map((c, i) => (
                <div key={i} class="flex items-center gap-2">
                  <select
                    class="select select-sm"
                    value={c.field}
                    onChange={(e) => updateCondition(i, { field: e.currentTarget.value as RuleField })}
                  >
                    {FIELDS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                  </select>
                  <select
                    class="select select-sm"
                    value={c.operator}
                    onChange={(e) => updateCondition(i, { operator: e.currentTarget.value as RuleOperator })}
                  >
                    {OPERATORS.map((o) => <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>)}
                  </select>
                  <input
                    type="text"
                    class="input input-sm flex-1"
                    placeholder="Value"
                    value={c.value}
                    onInput={(e) => updateCondition(i, { value: e.currentTarget.value })}
                  />
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-square text-error"
                    onClick={() => removeCondition(i)}
                    aria-label="Remove condition"
                  >
                    <span class="iconify lucide--minus size-4"></span>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-2" onClick={addCondition}>
              <span class="iconify lucide--plus size-4"></span>
              Add condition
            </button>
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
    </div>
  );
}
