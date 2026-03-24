import { useSignal } from "@preact/signals";
import type { BLOrder, DriveThruSentRecord, DriveThruTemplate } from "@/utils/types.ts";

function interpolate(body: string, order: BLOrder): string {
  return body
    .replaceAll("{{buyer_name}}", order.buyer_name)
    .replaceAll("{{buyer_email}}", order.buyer_email)
    .replaceAll("{{order_id}}", String(order.order_id))
    .replaceAll("{{order_date}}", new Date(order.date_ordered).toLocaleDateString())
    .replaceAll("{{total}}", `${order.disp_cost.currency_code} ${order.disp_cost.grand_total}`)
    .replaceAll("{{item_count}}", String(order.total_count))
    .replaceAll("{{lot_count}}", String(order.unique_count))
    .replaceAll("{{status}}", order.status)
    .replaceAll("{{payment_status}}", order.payment.status);
}

export default function DriveThruSend({
  order,
  templates,
  sentRecord,
}: {
  order: BLOrder;
  templates: DriveThruTemplate[];
  sentRecord: DriveThruSentRecord | null;
}) {
  const selectedId = useSignal(templates[0]?.id ?? "");
  const sending = useSignal(false);
  const error = useSignal<string | null>(null);
  const sent = useSignal<DriveThruSentRecord | null>(sentRecord);

  const selectedTemplate = templates.find((t) => t.id === selectedId.value) ?? null;
  const preview = selectedTemplate ? interpolate(selectedTemplate.body, order) : "";

  async function send() {
    sending.value = true;
    error.value = null;
    try {
      const resp = await fetch(`/api/drive-thru/${order.order_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedId.value || null }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      sent.value = {
        orderId: order.order_id,
        templateId: selectedId.value || null,
        templateName: selectedTemplate?.name ?? null,
        sentAt: data.sentAt,
      };
    } catch (err) {
      error.value = String(err);
    } finally {
      sending.value = false;
    }
  }

  return (
    <div class="space-y-6">
      {sent.value && (
        <div role="alert" class="alert alert-success">
          <span class="iconify lucide--circle-check size-5"></span>
          <div>
            <div class="font-medium">Drive Thru sent</div>
            <div class="text-sm">
              Sent {new Date(sent.value.sentAt).toLocaleString()}
              {sent.value.templateName && ` using "${sent.value.templateName}"`}
            </div>
          </div>
        </div>
      )}

      {error.value && (
        <div role="alert" class="alert alert-error">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>{error.value}</div>
        </div>
      )}

      {templates.length === 0
        ? (
          <div class="text-center py-12 text-base-content/50">
            <span class="iconify lucide--file-text size-12 block mx-auto mb-3"></span>
            <p class="font-medium">No templates yet</p>
            <p class="text-sm mt-1">
              <a href="/drive-thru/templates" class="link">Create a template</a> to get started.
            </p>
          </div>
        )
        : (
          <>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Template</legend>
              <select
                class="select w-full"
                value={selectedId.value}
                onChange={(e) => (selectedId.value = (e.target as HTMLSelectElement).value)}
              >
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <p class="label">
                <a href="/drive-thru/templates" class="link link-primary text-xs">Manage templates</a>
              </p>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Preview</legend>
              <div class="bg-base-200 rounded-box p-4 text-sm whitespace-pre-wrap min-h-24 font-mono">
                {preview || <span class="text-base-content/40 italic">Select a template to preview</span>}
              </div>
              <p class="label text-xs text-base-content/50">
                This previews how your BrickLink Drive Thru message will appear with order data substituted in.
              </p>
            </fieldset>

            <button
              type="button"
              class="btn btn-primary"
              disabled={sending.value || !selectedTemplate}
              onClick={send}
            >
              {sending.value
                ? <span class="loading loading-spinner loading-sm"></span>
                : <span class="iconify lucide--send size-4"></span>}
              {sent.value ? "Send Again" : "Send Drive Thru"}
            </button>
          </>
        )}
    </div>
  );
}
