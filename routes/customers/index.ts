import type { APIContext } from "astro";
import { getCredentials, getCrmMeta, getCustomer, listCustomers } from "@/utils/kv.ts";
import type { Customer } from "@/utils/types.ts";
import type { PageResult } from "@/routes/pageResult.ts";

const PAGE_SIZE = 20;

export type CustomersData = {
  customers: Customer[];
  nextCursor: string | null;
  currentCursor: string | null;
  history: string[];
  buyerFilter: string | null;
  lastRefreshedAt: string | null;
};

export async function loadCustomers({ url }: APIContext): Promise<PageResult<CustomersData>> {
  const creds = getCredentials();
  if (!creds) {
    return { kind: "redirect", to: "/environment" };
  }

  const buyerParam = url.searchParams.get("buyer");
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const history = url.searchParams.getAll("history");

  const meta = await getCrmMeta();

  // When a buyer filter is active, return just that one record.
  if (buyerParam) {
    const customer = await getCustomer(buyerParam);
    return {
      kind: "data",
      data: {
        customers: customer ? [customer] : [],
        nextCursor: null,
        currentCursor: null,
        history: [],
        buyerFilter: buyerParam,
        lastRefreshedAt: meta?.lastRefreshedAt ?? null,
      },
    };
  }

  const { customers, nextCursor } = await listCustomers(PAGE_SIZE, cursor);

  return {
    kind: "data",
    data: {
      customers,
      nextCursor,
      currentCursor: cursor ?? null,
      history,
      buyerFilter: null,
      lastRefreshedAt: meta?.lastRefreshedAt ?? null,
    },
  };
}
