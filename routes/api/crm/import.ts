import { parse } from "@std/csv";
import { define } from "@/utils/fresh.ts";
import { getCredentials, saveOrderCache } from "@/utils/kv.ts";
import type { BLOrderSummary } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "crm", "import"]);

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

/** Parse MM/DD/YYYY → ISO 8601 date string, or return null if invalid. */
function parseDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const date = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00.000Z`);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Strip a leading $ and return a decimal string, or null if invalid. */
function parseValue(value: string): string | null {
  const stripped = value.trim().replace(/^\$/, "");
  const num = parseFloat(stripped);
  if (isNaN(num)) return null;
  return num.toFixed(4);
}

export const handler = define.handlers({
  async POST(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return Response.json({ error: "Not configured" }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await ctx.req.formData();
    } catch {
      return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Missing file field" }, { status: 400 });
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      return Response.json({ error: "Could not read file" }, { status: 400 });
    }

    let rows: Record<string, string>[];
    try {
      rows = parse(text, { skipFirstRow: true, strip: true }) as Record<string, string>[];
    } catch (err) {
      return Response.json({ error: `CSV parse error: ${err}` }, { status: 400 });
    }

    logger.debug`CRM import: ${rows.length} row(s) parsed from CSV`;

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-based + header row

      const orderIdRaw = row["order_id"]?.trim();
      const buyerName = row["buyer_name"]?.trim();
      const dateRaw = row["date_ordered"]?.trim();
      const valueRaw = row["value"]?.trim();

      if (!orderIdRaw || !buyerName || !dateRaw || !valueRaw) {
        result.errors.push({
          row: rowNum,
          reason: "Missing required field(s): order_id, buyer_name, date_ordered, value",
        });
        continue;
      }

      const orderId = parseInt(orderIdRaw, 10);
      if (isNaN(orderId) || orderId <= 0) {
        result.errors.push({ row: rowNum, reason: `Invalid order_id: ${orderIdRaw}` });
        continue;
      }

      const dateOrdered = parseDate(dateRaw);
      if (!dateOrdered) {
        result.errors.push({ row: rowNum, reason: `Invalid date_ordered (expected MM/DD/YYYY): ${dateRaw}` });
        continue;
      }

      const grandTotal = parseValue(valueRaw);
      if (!grandTotal) {
        result.errors.push({ row: rowNum, reason: `Invalid value: ${valueRaw}` });
        continue;
      }

      const order: BLOrderSummary = {
        order_id: orderId,
        date_ordered: dateOrdered,
        seller_name: "Ludeck",
        store_name: "Bayside Brickstore",
        buyer_name: buyerName,
        total_count: 0,
        unique_count: 0,
        status: "COMPLETED",
        payment: {
          method: "",
          status: "",
          date_paid: "",
          currency_code: "",
        },
        cost: {
          currency_code: "AUD",
          subtotal: "0.0000",
          grand_total: grandTotal,
        },
      };

      try {
        await saveOrderCache(order);
        result.imported++;
      } catch (err) {
        result.errors.push({ row: rowNum, reason: `Failed to save: ${err}` });
      }
    }

    logger
      .debug`CRM import complete: imported=${result.imported} skipped=${result.skipped} errors=${result.errors.length}`;
    return Response.json(result);
  },
});
