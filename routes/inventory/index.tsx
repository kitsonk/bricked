import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import InventoryIsland from "@/islands/Inventory.tsx";

export type InventoryData = Record<never, never>;

export const handler = define.handlers<InventoryData>({
  GET(_ctx) {
    return page({});
  },
});

export function InventoryContent(_: { data: InventoryData }) {
  return (
    <>
      <h1 class="text-2xl font-bold mb-6">Inventory</h1>
      <InventoryIsland />
    </>
  );
}

export default define.page<typeof handler>(function Inventory({ data }) {
  return (
    <AppFrame>
      <InventoryContent data={data} />
    </AppFrame>
  );
});
