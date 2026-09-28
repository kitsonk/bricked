import type { APIContext } from "astro";
import { BricklinkClient } from "@/utils/bricklink.ts";
import {
  getCredentials,
  getOrderMessageCountCache,
  listCachedOrdersByBuyer,
  saveOrderMessageCountCache,
} from "@/utils/kv.ts";
import type { BLMemberRating, BLOrderSummary } from "@/utils/types.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type CustomerDetailData = {
  username: string;
  rating: BLMemberRating | null;
  orders: BLOrderSummary[];
  messageCounts: Record<number, number>;
  ratingError: string | null;
};

export async function loadCustomerDetail({ params }: APIContext): Promise<PageResult<CustomerDetailData>> {
  const creds = getCredentials();
  if (!creds) return { kind: "redirect", to: "/environment" };

  const username = decodeURIComponent(params.username ?? "");
  const client = new BricklinkClient(creds);

  const [ratingResult, orders] = await Promise.all([
    client.getMemberRating(username).then((r) => ({ ok: true as const, value: r })).catch((e) => ({
      ok: false as const,
      error: String(e),
    })),
    listCachedOrdersByBuyer(username),
  ]);

  const counts = await Promise.all(
    orders.map(async (o) => {
      const cached = await getOrderMessageCountCache(o.order_id);
      if (cached !== null) return [o.order_id, cached] as const;
      try {
        const msgs = await client.getOrderMessages(o.order_id);
        const count = msgs.length;
        await saveOrderMessageCountCache(o.order_id, count);
        return [o.order_id, count] as const;
      } catch {
        return [o.order_id, 0] as const;
      }
    }),
  );
  const messageCounts = Object.fromEntries(counts);

  return {
    kind: "data",
    data: {
      username,
      rating: ratingResult.ok ? ratingResult.value : null,
      orders,
      messageCounts,
      ratingError: ratingResult.ok ? null : ratingResult.error,
    },
  };
}
