import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { getColorsMeta, listColors } from "@/utils/kv.ts";
import type { BLColor, ColorsMeta } from "@/utils/types.ts";
import ColorsIsland from "@/islands/Colors.tsx";

export type ColorsData = {
  colors: BLColor[];
  meta: ColorsMeta | null;
};

export const handler = define.handlers<ColorsData>({
  async GET(_ctx) {
    const [colors, meta] = await Promise.all([listColors(), getColorsMeta()]);
    return page({ colors, meta });
  },
});

export function ColorsContent({ data }: { data: ColorsData }) {
  return <ColorsIsland initialColors={data.colors} initialMeta={data.meta} />;
}

export default define.page<typeof handler>(function ColorsPage({ data }) {
  return (
    <AppFrame>
      <ColorsContent data={data} />
    </AppFrame>
  );
});
