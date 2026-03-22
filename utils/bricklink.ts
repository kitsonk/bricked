import type { BLNotification, BLOrder, BLOrderItem, BricklinkCredentials } from "@/utils/types.ts";
import { buildOAuthHeader } from "@/utils/oauth.ts";

const BASE_URL = "https://api.bricklink.com/api/store/v1";

interface BLResponse<T> {
  meta: { code: number; message: string; description: string };
  data: T;
}

export class BricklinkClient {
  constructor(private creds: BricklinkCredentials) {}

  async get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
    const auth = await buildOAuthHeader("GET", url.toString(), this.creds);
    const resp = await fetch(url.toString(), { headers: { Authorization: auth } });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`BrickLink HTTP ${resp.status}: ${text}`);
    }
    const body: BLResponse<T> = await resp.json();
    if (body.meta.code !== 200) {
      throw new Error(`BrickLink API error ${body.meta.code}: ${body.meta.description}`);
    }
    return body.data;
  }

  getOrders(direction: "in" | "out" = "in", statuses?: string[]): Promise<BLOrder[]> {
    const query: Record<string, string> = { direction };
    if (statuses?.length) {
      query.status = statuses.join(",");
    }
    return this.get<BLOrder[]>("/orders", query);
  }

  async getOrderItems(orderId: number): Promise<BLOrderItem[]> {
    // The API returns an array of batches; flatten them.
    const batches = await this.get<BLOrderItem[][]>(`/orders/${orderId}/items`);
    return batches.flat();
  }

  getNotifications(): Promise<BLNotification[]> {
    return this.get<BLNotification[]>("/notifications");
  }
}
