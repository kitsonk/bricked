import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { getCredentials, getCrmMeta, listCustomers } from "@/utils/kv.ts";
import type { Customer } from "@/utils/types.ts";
import CustomersTable from "@/islands/CustomersTable.tsx";

const PAGE_SIZE = 20;

export const handler = define.handlers<{
  customers: Customer[];
  nextCursor: string | null;
  currentCursor: string | null;
  history: string[];
  lastRefreshedAt: string | null;
}>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/environment");
    }
    const cursor = ctx.url.searchParams.get("cursor") ?? undefined;
    const history = ctx.url.searchParams.getAll("history");

    const [{ customers, nextCursor }, meta] = await Promise.all([
      listCustomers(PAGE_SIZE, cursor),
      getCrmMeta(),
    ]);

    return page({
      customers,
      nextCursor,
      currentCursor: cursor ?? null,
      history,
      lastRefreshedAt: meta?.lastRefreshedAt ?? null,
    });
  },
});

export default define.page<typeof handler>(function Customers({ data }) {
  return (
    <AppFrame>
      <CustomersTable
        initialCustomers={data.customers}
        nextCursor={data.nextCursor}
        currentCursor={data.currentCursor}
        history={data.history}
        lastRefreshedAt={data.lastRefreshedAt}
      />
    </AppFrame>
  );
});
