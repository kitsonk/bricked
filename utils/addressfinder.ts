import type { BLOrder, VerifiedAustralianAddress } from "@/utils/types.ts";
import { getLogger } from "@/utils/log.ts";

const API_URL = "https://api.addressfinder.io/api/au/address/v2/verification";
const logger = getLogger(["bricked", "addressfinder"]);

interface AddressFinderResponse {
  success: boolean;
  matched: boolean;
  address?: {
    full_address: string;
    address_line_1: string;
    address_line_2: string | null;
    locality_name: string;
    state_territory: string;
    postcode: string;
  };
  error_code?: string;
  message?: string;
}

export function getAddressFinderCredentials(): { key: string; secret: string } | null {
  const key = Deno.env.get("ADDRESSFINDER_KEY");
  const secret = Deno.env.get("ADDRESSFINDER_SECRET");
  if (!key || !secret) return null;
  return { key, secret };
}

/**
 * Verify an Australian shipping address using the AddressFinder API.
 * Returns null if the address could not be matched, throws on API errors.
 * Caller is responsible for ensuring country_code === "AU".
 */
export async function verifyAustralianAddress(
  address: BLOrder["shipping"]["address"],
): Promise<VerifiedAustralianAddress | null> {
  const creds = getAddressFinderCredentials();
  if (!creds) {
    throw new Error("AddressFinder credentials not configured (ADDRESSFINDER_KEY, ADDRESSFINDER_SECRET)");
  }

  const q = [
    address.address1,
    address.address2,
    address.city,
    address.state,
    address.postal_code,
  ].filter(Boolean).join(", ");

  const url = new URL(API_URL);
  url.searchParams.set("key", creds.key);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("gnaf", "1");
  url.searchParams.set("paf", "1");

  logger.debug`Verifying AU address: ${q}`;

  const resp = await fetch(url, {
    headers: { Authorization: creds.secret },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AddressFinder HTTP ${resp.status}: ${text}`);
  }

  const body: AddressFinderResponse = await resp.json();

  if (!body.success) {
    throw new Error(`AddressFinder error ${body.error_code ?? "?"}: ${body.message ?? "Unknown error"}`);
  }

  if (!body.matched || !body.address) {
    logger.debug`Address not matched: ${q}`;
    return null;
  }

  const addr = body.address;
  logger.debug`Address matched: ${addr.full_address}`;

  return {
    addressLine1: addr.address_line_1,
    addressLine2: addr.address_line_2 ?? null,
    addressLine3: null,
    suburb: addr.locality_name,
    state: addr.state_territory,
    postcode: addr.postcode,
    fullAddress: addr.full_address,
  };
}
