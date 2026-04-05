import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { getCredentials, getCrmMeta, getCustomer, listCustomers } from "@/utils/kv.ts";
import type { Customer } from "@/utils/types.ts";
import CustomersTable from "@/islands/CustomersTable.tsx";

const PAGE_SIZE = 20;

export type CustomersData = {
  customers: Customer[];
  nextCursor: string | null;
  currentCursor: string | null;
  history: string[];
  buyerFilter: string | null;
  lastRefreshedAt: string | null;
};

export const handler = define.handlers<CustomersData>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/environment");
    }

    const buyerParam = ctx.url.searchParams.get("buyer");
    const cursor = ctx.url.searchParams.get("cursor") ?? undefined;
    const history = ctx.url.searchParams.getAll("history");

    const meta = await getCrmMeta();

    // When a buyer filter is active, return just that one record.
    if (buyerParam) {
      const customer = await getCustomer(buyerParam);
      return page({
        customers: customer ? [customer] : [],
        nextCursor: null,
        currentCursor: null,
        history: [],
        buyerFilter: buyerParam,
        lastRefreshedAt: meta?.lastRefreshedAt ?? null,
      });
    }

    const { customers, nextCursor } = await listCustomers(PAGE_SIZE, cursor);

    return page({
      customers,
      nextCursor,
      currentCursor: cursor ?? null,
      history,
      buyerFilter: null,
      lastRefreshedAt: meta?.lastRefreshedAt ?? null,
    });
  },
});

export function CustomersContent({ data }: { data: CustomersData }) {
  return (
    <CustomersTable
      initialCustomers={data.customers}
      nextCursor={data.nextCursor}
      currentCursor={data.currentCursor}
      history={data.history}
      buyerFilter={data.buyerFilter}
      lastRefreshedAt={data.lastRefreshedAt}
    />
  );
}

export default define.page<typeof handler>(function Customers({ data }) {
  return (
    <AppFrame>
      <CustomersContent data={data} />
    </AppFrame>
  );
});
