import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { BricklinkClient } from "@/utils/bricklink.ts";
import { getBuyerIndex, getCredentials } from "@/utils/kv.ts";

export type HomeData = {
  unfiledOrderCount: number;
  customerCount: number;
  error: string | null;
};

export const handler = define.handlers<HomeData>({
  async GET(ctx) {
    const creds = getCredentials();
    if (!creds) {
      return ctx.redirect("/environment");
    }
    try {
      const client = new BricklinkClient(creds);
      const [orders, buyers] = await Promise.all([
        client.getOrders("in", false),
        getBuyerIndex(),
      ]);
      return page({ unfiledOrderCount: orders.length, customerCount: buyers.length, error: null });
    } catch (err) {
      return page({ unfiledOrderCount: 0, customerCount: 0, error: String(err) });
    }
  },
});

export function HomeContent({ data }: { data: HomeData }) {
  return (
    <>
      <div class="flex flex-col items-center py-12">
        <img alt="bricked Logo" class="mb-6 h-24 w-24" src="/logo.svg" />
        <h1 class="text-5xl font-bold tracking-tight">bricked</h1>
        <p class="mt-2 text-lg text-base-content/60">BrickLink store management</p>
      </div>
      {data.error && (
        <div role="alert" class="alert alert-error mx-auto mb-6 max-w-3xl">
          <span class="iconify lucide--alert-circle size-5"></span>
          <div>
            <div class="font-medium">Failed to load dashboard data</div>
            <div class="text-sm">{data.error}</div>
          </div>
        </div>
      )}
      <div class="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
        <a
          href="/orders"
          class="card border border-base-content/10 bg-base-200 transition-colors hover:border-primary/40 hover:bg-base-300"
        >
          <div class="card-body items-center text-center">
            <span class="iconify lucide--shopping-bag mb-1 size-8 text-primary"></span>
            <h2 class="card-title">Orders</h2>
            {data.unfiledOrderCount > 0
              ? (
                <>
                  <p class="text-4xl font-bold tabular-nums">{data.unfiledOrderCount}</p>
                  <p class="text-sm text-base-content/60">unfiled orders</p>
                </>
              )
              : <p class="text-sm text-base-content/60">All caught up</p>}
          </div>
        </a>
        <a
          href="/inventory"
          class="card border border-base-content/10 bg-base-200 transition-colors hover:border-primary/40 hover:bg-base-300"
        >
          <div class="card-body items-center text-center">
            <span class="iconify lucide--warehouse mb-1 size-8 text-primary"></span>
            <h2 class="card-title">Inventory</h2>
            <p class="text-sm text-base-content/60">Browse your parts</p>
          </div>
        </a>
        <a
          href="/customers"
          class="card border border-base-content/10 bg-base-200 transition-colors hover:border-primary/40 hover:bg-base-300"
        >
          <div class="card-body items-center text-center">
            <span class="iconify lucide--users mb-1 size-8 text-primary"></span>
            <h2 class="card-title">Customers</h2>
            {data.customerCount > 0
              ? (
                <>
                  <p class="text-4xl font-bold tabular-nums">{data.customerCount}</p>
                  <p class="text-sm text-base-content/60">customers</p>
                </>
              )
              : <p class="text-sm text-base-content/60">No customers yet</p>}
          </div>
        </a>
      </div>
    </>
  );
}

export default define.page<typeof handler>(function Home({ data }) {
  return (
    <AppFrame>
      <HomeContent data={data} />
    </AppFrame>
  );
});
