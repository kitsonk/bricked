import type { BricklinkCredentials } from "@/utils/types.ts";

export function percentEncode(str: string): string {
  // encodeURIComponent leaves !'()* unencoded; OAuth requires them encoded.
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

export async function hmacSha1(key: string, data: string): Promise<string> {
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

/**
 * Sort and encode a flat params map into an OAuth parameter string.
 * Uses ascending byte-value ordering as required by RFC 5849 §3.4.1.3.2.
 */
export function buildParamString(params: Record<string, string>): string {
  return Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
}

/**
 * Build the OAuth 1.0a Authorization header value for a request.
 * `overrides` allows injecting a fixed timestamp/nonce for testing.
 */
export async function buildOAuthHeader(
  method: string,
  url: string,
  creds: BricklinkCredentials,
  overrides?: { timestamp?: string; nonce?: string },
): Promise<string> {
  const timestamp = overrides?.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const nonce = overrides?.nonce ?? crypto.randomUUID().replace(/-/g, "");

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

  const paramString = buildParamString(allParams);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  const signatureBase = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(paramString)].join("&");
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.tokenSecret)}`;
  const signature = await hmacSha1(signingKey, signatureBase);

  const parts = Object.entries({ ...oauthParams, oauth_signature: signature })
    .map(([k, v]) => `${k}="${percentEncode(v)}"`)
    .join(", ");

  return `OAuth realm="", ${parts}`;
}
