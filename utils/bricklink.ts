import type { BLNotification, BLOrder, BLOrderItem, BLShippingMethod, BricklinkCredentials } from "@/utils/types.ts";
import { buildOAuthHeader } from "@/utils/oauth.ts";
import { getLogger } from "@/utils/log.ts";

const BASE_URL = "https://api.bricklink.com/api/store/v1";
const logger = getLogger(["bricked", "bricklink"]);

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
    // URLSearchParams encodes commas as %2C, but BrickLink requires literal commas
    // in multi-value parameters (e.g. status=PENDING,PAID). Setting .search
    // directly preserves literal commas since they are not in the special-query
    // percent-encode set, allowing the URL object to be used for both signing and fetch.
    url.search = url.search.replaceAll("%2C", ",");
    logger.debug`GET ${url.toString()}`;
    const auth = await buildOAuthHeader("GET", url, this.creds);
    const resp = await fetch(url, { headers: { Authorization: auth } });
    logger.debug`GET ${url.pathname} → HTTP ${resp.status}`;
    if (!resp.ok) {
      const text = await resp.text();
      logger.error`BrickLink HTTP error ${resp.status} for GET ${url.pathname}: ${text}`;
      throw new Error(`BrickLink HTTP ${resp.status}: ${text}`);
    }
    const body: BLResponse<T> = await resp.json();
    logger.debug`GET ${url.pathname} meta: code=${body.meta.code} message=${body.meta.message}`;
    if (body.meta.code !== 200) {
      logger.error`BrickLink API error for GET ${url.pathname}: ${body.meta.code} ${body.meta.description}`;
      throw new Error(`BrickLink API error ${body.meta.code}: ${body.meta.description}`);
    }
    return body.data;
  }

  async getOrders(direction: "in" | "out" = "in", filed = false, statuses?: string[]): Promise<BLOrder[]> {
    const query: Record<string, string> = { direction };
    if (filed) query.filed = "true";
    if (statuses?.length) query.status = statuses.join(",");
    logger.debug`getOrders direction=${direction} filed=${filed} statuses=${statuses?.join(",") ?? "(none)"}`;
    const data = await this.get<BLOrder[] | null>("/orders", query);
    const orders = data ?? [];
    logger.debug`getOrders returned ${orders.length} order(s)`;
    return orders;
  }

  async getOrderItems(orderId: number): Promise<BLOrderItem[]> {
    // The API returns an array of batches; flatten them.
    const batches = await this.get<BLOrderItem[][]>(`/orders/${orderId}/items`);
    return batches.flat();
  }

  getNotifications(): Promise<BLNotification[]> {
    return this.get<BLNotification[]>("/notifications");
  }

  async getShippingMethods(): Promise<BLShippingMethod[]> {
    const data = await this.get<BLShippingMethod[] | null>("/settings/shipping_methods");
    return data ?? [];
  }

  getOrder(orderId: number): Promise<BLOrder> {
    return this.get<BLOrder>(`/orders/${orderId}`);
  }

  async updateOrderStatus(orderId: number, status: string): Promise<void> {
    const url = new URL(`${BASE_URL}/orders/${orderId}/status`);
    const auth = await buildOAuthHeader("PUT", url, this.creds);
    const resp = await fetch(url, {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ field: "status", value: status }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`BrickLink HTTP ${resp.status}: ${text}`);
    }
    const body: BLResponse<unknown> = await resp.json();
    if (body.meta.code !== 200) {
      throw new Error(`BrickLink API error ${body.meta.code}: ${body.meta.description}`);
    }
  }

  async updateOrderShipping(
    orderId: number,
    data: { date_shipped: string; tracking_no: string; tracking_link: string },
  ): Promise<void> {
    const url = new URL(`${BASE_URL}/orders/${orderId}/shipping`);
    const auth = await buildOAuthHeader("PUT", url, this.creds);
    const resp = await fetch(url, {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`BrickLink HTTP ${resp.status}: ${text}`);
    }
    const body: BLResponse<unknown> = await resp.json();
    if (body.meta.code !== 200) {
      throw new Error(`BrickLink API error ${body.meta.code}: ${body.meta.description}`);
    }
  }

  async sendDriveThru(orderId: number): Promise<void> {
    const url = new URL(`${BASE_URL}/orders/${orderId}/drive_thru`);
    const auth = await buildOAuthHeader("POST", url, this.creds);
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ mail_me: false }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`BrickLink HTTP ${resp.status}: ${text}`);
    }
    const body: BLResponse<unknown> = await resp.json();
    if (body.meta.code !== 200) {
      throw new Error(`BrickLink API error ${body.meta.code}: ${body.meta.description}`);
    }
  }
}
