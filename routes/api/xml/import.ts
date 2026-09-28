import type { APIContext } from "astro";
import { parse } from "@libs/xml";
import { getColor } from "@/utils/kv.ts";
import type { ImportedItem, ImportedItemCondition, ImportedItemType } from "@/utils/types.ts";

export async function POST({ request }: APIContext): Promise<Response> {
  let text: string;
  try {
    text = await request.text();
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
        ITEMTYPE: String(item.ITEMTYPE ?? "P") as ImportedItemType,
        ITEMID: String(item.ITEMID ?? ""),
        ...(colorNum !== 0 && { COLOR: colorNum }),
        ...(color && { COLOR_NAME: color.color_name }),
        PRICE: parseFloat(parseFloat(String(item.PRICE ?? "0")).toFixed(2)),
        QTY: parseInt(String(item.QTY ?? "1"), 10),
        CONDITION: String(item.CONDITION ?? "N") as ImportedItemCondition,
        DESCRIPTION: String(item.DESCRIPTION ?? ""),
        REMARKS: String(item.REMARKS ?? ""),
      };
    }),
  );
  return Response.json({ items });
}
