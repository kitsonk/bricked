import { parse } from "@libs/xml";
import { define } from "@/utils/fresh.ts";
import { getColor } from "@/utils/kv.ts";

type ItemType = "S" | "P" | "M" | "B" | "G" | "C" | "I" | "O";
type Condition = "N" | "U";

export type ImportedItem = {
  ITEMTYPE: ItemType;
  ITEMID: string;
  COLOR?: number;
  COLOR_NAME?: string;
  PRICE: number;
  QTY: number;
  CONDITION: Condition;
  DESCRIPTION: string;
  REMARKS: string;
};

export const handler = define.handlers({
  async POST(ctx) {
    let text: string;
    try {
      text = await ctx.req.text();
    } catch {
      return Response.json({ error: "Could not read request body" }, { status: 400 });
    }
    if (!text.trim()) {
      return Response.json({ error: "Empty body" }, { status: 400 });
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = parse(text) as Record<string, unknown>;
    } catch (err) {
      return Response.json({ error: `Failed to parse XML: ${String(err)}` }, { status: 422 });
    }
    const inventory = parsed?.INVENTORY as Record<string, unknown> | undefined;
    const rawItems = inventory?.ITEM;
    const itemArray: Record<string, unknown>[] = Array.isArray(rawItems)
      ? rawItems
      : rawItems != null
      ? [rawItems as Record<string, unknown>]
      : [];
    const items: ImportedItem[] = await Promise.all(
      itemArray.map(async (item) => {
        const colorNum = Number(item.COLOR ?? 0);
        const color = colorNum !== 0 ? await getColor(colorNum) : null;
        return {
          ITEMTYPE: String(item.ITEMTYPE ?? "P") as ItemType,
          ITEMID: String(item.ITEMID ?? ""),
          ...(colorNum !== 0 && { COLOR: colorNum }),
          ...(color && { COLOR_NAME: color.color_name }),
          PRICE: parseFloat(parseFloat(String(item.PRICE ?? "0")).toFixed(2)),
          QTY: parseInt(String(item.QTY ?? "1"), 10),
          CONDITION: String(item.CONDITION ?? "N") as Condition,
          DESCRIPTION: String(item.DESCRIPTION ?? ""),
          REMARKS: String(item.REMARKS ?? ""),
        };
      }),
    );
    return Response.json({ items });
  },
});
