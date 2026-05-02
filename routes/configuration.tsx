import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { getSenderAddress } from "@/utils/kv.ts";
import type { AusPostAddress } from "@/utils/types.ts";
import Configuration from "@/islands/Configuration.tsx";

export type ConfigurationData = { address: AusPostAddress | null };

export const handler = define.handlers<ConfigurationData>({
  async GET() {
    const address = await getSenderAddress();
    return page({ address });
  },
});

export function ConfigurationContent({ data }: { data: ConfigurationData }) {
  return (
    <>
      <h1 class="text-2xl font-bold mb-6">Configuration</h1>
      <Configuration initialAddress={data.address} />
    </>
  );
}

export default define.page<typeof handler>(function ConfigurationPage({ data }) {
  return (
    <AppFrame>
      <ConfigurationContent data={data} />
    </AppFrame>
  );
});
