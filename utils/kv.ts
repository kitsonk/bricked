import type {
  AusPostAddress,
  BLOrderSummary,
  BLShippingMethod,
  BricklinkCredentials,
  CrmMeta,
  Customer,
  DriveThruSentRecord,
  DriveThruTemplate,
  PackageType,
  ShippingMethodEnrichment,
  StoredNotification,
} from "@/utils/types.ts";

export function getCredentials(): BricklinkCredentials | null {
  const consumerKey = Deno.env.get("BRICKLINK_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("BRICKLINK_CONSUMER_SECRET");
  const tokenValue = Deno.env.get("BRICKLINK_TOKEN");
  const tokenSecret = Deno.env.get("BRICKLINK_TOKEN_SECRET");
  if (!consumerKey || !consumerSecret || !tokenValue || !tokenSecret) return null;
  return { consumerKey, consumerSecret, tokenValue, tokenSecret };
}

let _kv: Deno.Kv | null = null;

async function kv(): Promise<Deno.Kv> {
  if (!_kv) _kv = await Deno.openKv();
  return _kv;
}

// Notifications are stored under ["notifications", <iso-timestamp>, <id>] so
// they naturally sort chronologically when listed.
function notificationKey(receivedAt: string, id: string): Deno.KvKey {
  return ["notifications", receivedAt, id];
}

export async function saveNotification(notification: StoredNotification): Promise<Deno.KvCommitResult> {
  return (await kv()).set(notificationKey(notification.receivedAt, notification.id), notification);
}

export async function listNotifications(): Promise<StoredNotification[]> {
  const entries = (await kv()).list<StoredNotification>({ prefix: ["notifications"] });
  const results: StoredNotification[] = [];
  for await (const entry of entries) {
    results.push(entry.value);
  }
  return results;
}

// Drive Thru Templates

function driveThruTemplateKey(id: string): Deno.KvKey {
  return ["drive_thru_templates", id];
}

export async function listDriveThruTemplates(): Promise<DriveThruTemplate[]> {
  const entries = (await kv()).list<DriveThruTemplate>({ prefix: ["drive_thru_templates"] });
  const results: DriveThruTemplate[] = [];
  for await (const entry of entries) {
    results.push(entry.value);
  }
  return results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getDriveThruTemplate(id: string): Promise<DriveThruTemplate | null> {
  const result = await (await kv()).get<DriveThruTemplate>(driveThruTemplateKey(id));
  return result.value;
}

export async function saveDriveThruTemplate(template: DriveThruTemplate): Promise<Deno.KvCommitResult> {
  return (await kv()).set(driveThruTemplateKey(template.id), template);
}

export async function deleteDriveThruTemplate(id: string): Promise<void> {
  return (await kv()).delete(driveThruTemplateKey(id));
}

// Drive Thru Sent Records

function driveThruSentKey(orderId: number): Deno.KvKey {
  return ["drive_thru_sent", orderId];
}

export async function recordDriveThruSent(record: DriveThruSentRecord): Promise<Deno.KvCommitResult> {
  return (await kv()).set(driveThruSentKey(record.orderId), record);
}

export async function getDriveThruSent(orderId: number): Promise<DriveThruSentRecord | null> {
  const result = await (await kv()).get<DriveThruSentRecord>(driveThruSentKey(orderId));
  return result.value;
}

export async function listDriveThruSentOrderIds(): Promise<number[]> {
  const entries = (await kv()).list<DriveThruSentRecord>({ prefix: ["drive_thru_sent"] });
  const ids: number[] = [];
  for await (const entry of entries) {
    ids.push(entry.value.orderId);
  }
  return ids;
}

// Shipping Methods Cache

export interface ShippingMethodsCache {
  methods: BLShippingMethod[];
  fetchedAt: string;
}

const SHIPPING_METHODS_CACHE_KEY: Deno.KvKey = ["shipping_methods_cache"];

export async function getShippingMethodsCache(): Promise<ShippingMethodsCache | null> {
  const result = await (await kv()).get<ShippingMethodsCache>(SHIPPING_METHODS_CACHE_KEY);
  return result.value;
}

export async function saveShippingMethodsCache(cache: ShippingMethodsCache): Promise<Deno.KvCommitResult> {
  return (await kv()).set(SHIPPING_METHODS_CACHE_KEY, cache);
}

// Shipping Method Enrichment

function shippingMethodEnrichmentKey(methodId: number): Deno.KvKey {
  return ["shipping_method_enrichment", methodId];
}

export async function getShippingMethodEnrichment(methodId: number): Promise<ShippingMethodEnrichment | null> {
  const result = await (await kv()).get<ShippingMethodEnrichment>(shippingMethodEnrichmentKey(methodId));
  return result.value;
}

export async function saveShippingMethodEnrichment(
  methodId: number,
  enrichment: ShippingMethodEnrichment,
): Promise<Deno.KvCommitResult> {
  return (await kv()).set(shippingMethodEnrichmentKey(methodId), enrichment);
}

export async function deleteShippingMethodEnrichment(methodId: number): Promise<void> {
  return (await kv()).delete(shippingMethodEnrichmentKey(methodId));
}

export async function listShippingMethodEnrichments(): Promise<Map<number, ShippingMethodEnrichment>> {
  const entries = (await kv()).list<ShippingMethodEnrichment>({ prefix: ["shipping_method_enrichment"] });
  const map = new Map<number, ShippingMethodEnrichment>();
  for await (const entry of entries) {
    map.set(entry.key[1] as number, entry.value);
  }
  return map;
}

// Package Types

function packageTypeKey(id: string): Deno.KvKey {
  return ["package_type", id];
}

export async function listPackageTypes(): Promise<PackageType[]> {
  const entries = (await kv()).list<PackageType>({ prefix: ["package_type"] });
  const results: PackageType[] = [];
  for await (const entry of entries) {
    results.push(entry.value);
  }
  return results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getPackageType(id: string): Promise<PackageType | null> {
  const result = await (await kv()).get<PackageType>(packageTypeKey(id));
  return result.value;
}

export async function savePackageType(packageType: PackageType): Promise<Deno.KvCommitResult> {
  return (await kv()).set(packageTypeKey(packageType.id), packageType);
}

export async function deletePackageType(id: string): Promise<void> {
  return (await kv()).delete(packageTypeKey(id));
}

// Ship List Addresses

function shipListAddressKey(orderId: number): Deno.KvKey {
  return ["ship_list_address", orderId];
}

export async function getShipListAddress(orderId: number): Promise<AusPostAddress | null> {
  const result = await (await kv()).get<AusPostAddress>(shipListAddressKey(orderId));
  return result.value;
}

export async function saveShipListAddress(orderId: number, address: AusPostAddress): Promise<Deno.KvCommitResult> {
  return (await kv()).set(shipListAddressKey(orderId), address);
}

// Order Cache

function orderCacheKey(orderId: number): Deno.KvKey {
  return ["order_cache", orderId];
}

/**
 * Persist a BrickLink order summary to the local cache.
 * Only call this for non-PURGED orders — callers are responsible for the guard.
 */
export async function saveOrderCache(order: BLOrderSummary): Promise<Deno.KvCommitResult> {
  return (await kv()).set(orderCacheKey(order.order_id), order);
}

/** Return every order summary stored in the local cache. */
export async function listCachedOrders(): Promise<BLOrderSummary[]> {
  const iter = (await kv()).list<BLOrderSummary>({ prefix: ["order_cache"] });
  const results: BLOrderSummary[] = [];
  for await (const entry of iter) {
    results.push(entry.value);
  }
  return results;
}

// CRM Customers

function customerKey(buyerName: string): Deno.KvKey {
  return ["crm_customer", buyerName];
}

export async function saveCustomer(customer: Customer): Promise<Deno.KvCommitResult> {
  return (await kv()).set(customerKey(customer.buyerName), customer);
}

export interface CustomerPage {
  customers: Customer[];
  /** Opaque KV cursor for the next page, or null if this is the last page. */
  nextCursor: string | null;
}

export async function listCustomers(limit = 20, cursor?: string): Promise<CustomerPage> {
  const db = await kv();
  const listOptions: Deno.KvListOptions = { limit };
  if (cursor) listOptions.cursor = cursor;

  const iter = db.list<Customer>({ prefix: ["crm_customer"] }, listOptions);
  const results: Customer[] = [];
  for await (const entry of iter) {
    results.push(entry.value);
  }

  // Peek one entry beyond the current page to determine whether a next page exists.
  let nextCursor: string | null = null;
  if (results.length === limit) {
    const peekIter = db.list<Customer>({ prefix: ["crm_customer"] }, { limit: 1, cursor: iter.cursor });
    const peek = await peekIter.next();
    if (!peek.done) {
      nextCursor = iter.cursor;
    }
  }

  return { customers: results, nextCursor };
}

// CRM Metadata

const CRM_META_KEY: Deno.KvKey = ["crm_meta"];

export async function getCrmMeta(): Promise<CrmMeta | null> {
  const result = await (await kv()).get<CrmMeta>(CRM_META_KEY);
  return result.value;
}

export async function saveCrmMeta(meta: CrmMeta): Promise<Deno.KvCommitResult> {
  return (await kv()).set(CRM_META_KEY, meta);
}
