import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";

export type InventoryData = Record<never, never>;

export const handler = define.handlers<InventoryData>({
  GET(_ctx) {
    return page({});
  },
});

export function InventoryContent(_: { data: InventoryData }) {
  return (
    <div class="p-6">
      <h1 class="text-2xl font-semibold">Inventory</h1>
      <p class="text-base-content/60 mt-2">Coming soon.</p>
    </div>
  );
}

export default define.page<typeof handler>(function Inventory({ data }) {
  return (
    <AppFrame>
      <InventoryContent data={data} />
    </AppFrame>
  );
});
