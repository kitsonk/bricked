import type { BLOrder, BLOrderItem, BricklinkCredentials } from "@/utils/types.ts";

const BASE_URL = "https://api.bricklink.com/api/store/v1";

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

async function hmacSha1(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function oauthHeader(method: string, url: string, creds: BricklinkCredentials): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: creds.tokenValue,
    oauth_version: "1.0",
  };

  const urlObj = new URL(url);
  const allParams: Record<string, string> = { ...oauthParams };
  urlObj.searchParams.forEach((value, key) => {
    allParams[key] = value;
  });

  const paramString = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  const signatureBase = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(paramString)].join("&");
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.tokenSecret)}`;
  const signature = await hmacSha1(signingKey, signatureBase);

  const parts = Object.entries({ ...oauthParams, oauth_signature: signature })
    .map(([k, v]) => `${k}="${percentEncode(v)}"`)
    .join(", ");

  return `OAuth realm="", ${parts}`;
}

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
    const auth = await oauthHeader("GET", url.toString(), this.creds);
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
}
