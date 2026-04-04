import type {
  AusPostAddress,
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

// Notifications are stored under ["notifications", <iso-timestamp>, <id>] so
// they naturally sort chronologically when listed.
function notificationKey(receivedAt: string, id: string): Deno.KvKey {
  return ["notifications", receivedAt, id];
}

export async function saveNotification(notification: StoredNotification): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(notificationKey(notification.receivedAt, notification.id), notification);
}

export async function listNotifications(): Promise<StoredNotification[]> {
  const kv = await Deno.openKv();
  const entries = kv.list<StoredNotification>({ prefix: ["notifications"] });
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
  const kv = await Deno.openKv();
  const entries = kv.list<DriveThruTemplate>({ prefix: ["drive_thru_templates"] });
  const results: DriveThruTemplate[] = [];
  for await (const entry of entries) {
    results.push(entry.value);
  }
  return results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getDriveThruTemplate(id: string): Promise<DriveThruTemplate | null> {
  const kv = await Deno.openKv();
  const result = await kv.get<DriveThruTemplate>(driveThruTemplateKey(id));
  return result.value;
}

export async function saveDriveThruTemplate(template: DriveThruTemplate): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(driveThruTemplateKey(template.id), template);
}

export async function deleteDriveThruTemplate(id: string): Promise<void> {
  const kv = await Deno.openKv();
  await kv.delete(driveThruTemplateKey(id));
}

// Drive Thru Sent Records

function driveThruSentKey(orderId: number): Deno.KvKey {
  return ["drive_thru_sent", orderId];
}

export async function recordDriveThruSent(record: DriveThruSentRecord): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(driveThruSentKey(record.orderId), record);
}

export async function getDriveThruSent(orderId: number): Promise<DriveThruSentRecord | null> {
  const kv = await Deno.openKv();
  const result = await kv.get<DriveThruSentRecord>(driveThruSentKey(orderId));
  return result.value;
}

export async function listDriveThruSentOrderIds(): Promise<number[]> {
  const kv = await Deno.openKv();
  const entries = kv.list<DriveThruSentRecord>({ prefix: ["drive_thru_sent"] });
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
  const kv = await Deno.openKv();
  const result = await kv.get<ShippingMethodsCache>(SHIPPING_METHODS_CACHE_KEY);
  return result.value;
}

export async function saveShippingMethodsCache(cache: ShippingMethodsCache): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(SHIPPING_METHODS_CACHE_KEY, cache);
}

// Shipping Method Enrichment

function shippingMethodEnrichmentKey(methodId: number): Deno.KvKey {
  return ["shipping_method_enrichment", methodId];
}

export async function getShippingMethodEnrichment(methodId: number): Promise<ShippingMethodEnrichment | null> {
  const kv = await Deno.openKv();
  const result = await kv.get<ShippingMethodEnrichment>(shippingMethodEnrichmentKey(methodId));
  return result.value;
}

export async function saveShippingMethodEnrichment(
  methodId: number,
  enrichment: ShippingMethodEnrichment,
): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(shippingMethodEnrichmentKey(methodId), enrichment);
}

export async function deleteShippingMethodEnrichment(methodId: number): Promise<void> {
  const kv = await Deno.openKv();
  await kv.delete(shippingMethodEnrichmentKey(methodId));
}

export async function listShippingMethodEnrichments(): Promise<Map<number, ShippingMethodEnrichment>> {
  const kv = await Deno.openKv();
  const entries = kv.list<ShippingMethodEnrichment>({ prefix: ["shipping_method_enrichment"] });
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
  const kv = await Deno.openKv();
  const entries = kv.list<PackageType>({ prefix: ["package_type"] });
  const results: PackageType[] = [];
  for await (const entry of entries) {
    results.push(entry.value);
  }
  return results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getPackageType(id: string): Promise<PackageType | null> {
  const kv = await Deno.openKv();
  const result = await kv.get<PackageType>(packageTypeKey(id));
  return result.value;
}

export async function savePackageType(packageType: PackageType): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(packageTypeKey(packageType.id), packageType);
}

export async function deletePackageType(id: string): Promise<void> {
  const kv = await Deno.openKv();
  await kv.delete(packageTypeKey(id));
}

// Ship List Addresses

function shipListAddressKey(orderId: number): Deno.KvKey {
  return ["ship_list_address", orderId];
}

export async function getShipListAddress(orderId: number): Promise<AusPostAddress | null> {
  const kv = await Deno.openKv();
  const result = await kv.get<AusPostAddress>(shipListAddressKey(orderId));
  return result.value;
}

export async function saveShipListAddress(orderId: number, address: AusPostAddress): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(shipListAddressKey(orderId), address);
}

// CRM Customers

function customerKey(buyerName: string): Deno.KvKey {
  return ["crm_customer", buyerName];
}

export async function saveCustomer(customer: Customer): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(customerKey(customer.buyerName), customer);
}

export interface CustomerPage {
  customers: Customer[];
  /** Opaque KV cursor for the next page, or null if this is the last page. */
  nextCursor: string | null;
}

export async function listCustomers(limit = 20, cursor?: string): Promise<CustomerPage> {
  const kv = await Deno.openKv();
  const listOptions: Deno.KvListOptions = { limit };
  if (cursor) listOptions.cursor = cursor;

  const iter = kv.list<Customer>({ prefix: ["crm_customer"] }, listOptions);
  const results: Customer[] = [];
  for await (const entry of iter) {
    results.push(entry.value);
  }

  // Peek one entry beyond the current page to determine whether a next page exists.
  let nextCursor: string | null = null;
  if (results.length === limit) {
    const peekIter = kv.list<Customer>({ prefix: ["crm_customer"] }, { limit: 1, cursor: iter.cursor });
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
  const kv = await Deno.openKv();
  const result = await kv.get<CrmMeta>(CRM_META_KEY);
  return result.value;
}

export async function saveCrmMeta(meta: CrmMeta): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(CRM_META_KEY, meta);
}
