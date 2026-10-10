import { BricklinkClient } from "@/utils/bricklink.ts";
import { getBuyerIndex, getCredentials } from "@/utils/kv.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type HomeData = {
  unfiledOrderCount: number;
  customerCount: number;
  error: string | null;
};

export async function loadHome(): Promise<PageResult<HomeData>> {
  const creds = getCredentials();
  if (!creds) {
    return { kind: "redirect", to: "/environment" };
  }
  try {
    const client = new BricklinkClient(creds);
    const [orders, buyers] = await Promise.all([client.getOrders("in", false), getBuyerIndex()]);
    return { kind: "data", data: { unfiledOrderCount: orders.length, customerCount: buyers.length, error: null } };
  } catch (err) {
    return { kind: "data", data: { unfiledOrderCount: 0, customerCount: 0, error: String(err) } };
  }
}
