import { getColorsMeta, listColors } from "@/utils/kv.ts";
import type { BLColor, ColorsMeta } from "@/utils/types.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type ColorsData = {
  colors: BLColor[];
  meta: ColorsMeta | null;
};

export async function loadColors(): Promise<PageResult<ColorsData>> {
  const [colors, meta] = await Promise.all([listColors(), getColorsMeta()]);
  return { kind: "data", data: { colors, meta } };
}
