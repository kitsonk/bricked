import { KvU64, openKv } from "@deno/kv";
import type { Kv, KvCommitResult, KvKey, KvListOptions } from "@deno/kv";
import type {
  AusPostAddress,
  BLColor,
  BLOrderSummary,
  BLPriceGuide,
  BLShippingMethod,
  BricklinkCredentials,
  BricklinkSearchResult,
  ColorsMeta,
  CrmMeta,
  Customer,
  DriveThruSentRecord,
  DriveThruTemplate,
  LocalShippingOverride,
  PackageType,
  PricingSettings,
  ShippingMethodEnrichment,
  StoredNotification,
  TemplateRule,
} from "@/utils/types.ts";

export function getCredentials(): BricklinkCredentials | null {
  const consumerKey = process.env.BRICKLINK_CONSUMER_KEY;
  const consumerSecret = process.env.BRICKLINK_CONSUMER_SECRET;
  const tokenValue = process.env.BRICKLINK_TOKEN;
  const tokenSecret = process.env.BRICKLINK_TOKEN_SECRET;
  if (!consumerKey || !consumerSecret || !tokenValue || !tokenSecret) return null;
  return { consumerKey, consumerSecret, tokenValue, tokenSecret };
}

let _kv: Kv | null = null;

export async function kv(): Promise<Kv> {
  if (!_kv) {
    const instance = await openKv(process.env.KV_PATH ?? "kv.sqlite3");
    // `@kitsonk/logtape-kv-sink` constructs `new Deno.KvU64(...)` and `@kitsonk/kv-toolbox` branches
    // on `x instanceof Deno.Kv` (reached from blob writes). `@deno/kv` does not create a `Deno`
    // global, so install exactly the two members those packages evaluate.
    const g = globalThis as { Deno?: { KvU64?: unknown; Kv?: unknown } };
    g.Deno ??= {};
    g.Deno.KvU64 ??= KvU64;
    g.Deno.Kv ??= Object.getPrototypeOf(instance).constructor;
    _kv = instance;
  }
  return _kv;
}

// Notifications are stored under ["notifications", <iso-timestamp>, <id>] so
// they naturally sort chronologically when listed.
function notificationKey(receivedAt: string, id: string): KvKey {
  return ["notifications", receivedAt, id];
}

export async function saveNotification(notification: StoredNotification): Promise<KvCommitResult> {
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

function driveThruTemplateKey(id: string): KvKey {
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

export async function saveDriveThruTemplate(template: DriveThruTemplate): Promise<KvCommitResult> {
  return (await kv()).set(driveThruTemplateKey(template.id), template);
}

export async function deleteDriveThruTemplate(id: string): Promise<void> {
  return (await kv()).delete(driveThruTemplateKey(id));
}

// Drive Thru Sent Records

function driveThruSentKey(orderId: number): KvKey {
  return ["drive_thru_sent", orderId];
}

export async function recordDriveThruSent(record: DriveThruSentRecord): Promise<KvCommitResult> {
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

const SHIPPING_METHODS_CACHE_KEY: KvKey = ["shipping_methods_cache"];

export async function getShippingMethodsCache(): Promise<ShippingMethodsCache | null> {
  const result = await (await kv()).get<ShippingMethodsCache>(SHIPPING_METHODS_CACHE_KEY);
  return result.value;
}

export async function saveShippingMethodsCache(cache: ShippingMethodsCache): Promise<KvCommitResult> {
  return (await kv()).set(SHIPPING_METHODS_CACHE_KEY, cache);
}

// Shipping Method Enrichment

function shippingMethodEnrichmentKey(methodId: number): KvKey {
  return ["shipping_method_enrichment", methodId];
}

export async function getShippingMethodEnrichment(methodId: number): Promise<ShippingMethodEnrichment | null> {
  const result = await (await kv()).get<ShippingMethodEnrichment>(shippingMethodEnrichmentKey(methodId));
  return result.value;
}

export async function saveShippingMethodEnrichment(
  methodId: number,
  enrichment: ShippingMethodEnrichment,
): Promise<KvCommitResult> {
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

function packageTypeKey(id: string): KvKey {
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

export async function savePackageType(packageType: PackageType): Promise<KvCommitResult> {
  return (await kv()).set(packageTypeKey(packageType.id), packageType);
}

export async function deletePackageType(id: string): Promise<void> {
  return (await kv()).delete(packageTypeKey(id));
}

// Ship List Addresses

function shipListAddressKey(orderId: number): KvKey {
  return ["ship_list_address", orderId];
}

export async function getShipListAddress(orderId: number): Promise<AusPostAddress | null> {
  const result = await (await kv()).get<AusPostAddress>(shipListAddressKey(orderId));
  return result.value;
}

export async function saveShipListAddress(orderId: number, address: AusPostAddress): Promise<KvCommitResult> {
  return (await kv()).set(shipListAddressKey(orderId), address);
}

// Sender Address

const SENDER_ADDRESS_KEY: KvKey = ["sender_address"];

export async function getSenderAddress(): Promise<AusPostAddress | null> {
  const result = await (await kv()).get<AusPostAddress>(SENDER_ADDRESS_KEY);
  return result.value;
}

export async function saveSenderAddress(address: AusPostAddress): Promise<KvCommitResult> {
  return (await kv()).set(SENDER_ADDRESS_KEY, address);
}

function orderCacheKey(orderId: number): KvKey {
  return ["order_cache", orderId];
}

/**
 * Persist a BrickLink order summary to the local cache.
 * Only call this for non-PURGED orders — callers are responsible for the guard.
 */
export async function saveOrderCache(order: BLOrderSummary): Promise<KvCommitResult> {
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

/** Return all cached orders for a specific buyer, sorted newest first. */
export async function listCachedOrdersByBuyer(buyerName: string): Promise<BLOrderSummary[]> {
  const all = await listCachedOrders();
  return all.filter((o) => o.buyer_name === buyerName).sort((a, b) => b.date_ordered.localeCompare(a.date_ordered));
}

// Pricing Settings

const PRICING_SETTINGS_KEY: KvKey = ["pricing_settings"];

export async function getPricingSettings(): Promise<PricingSettings | null> {
  const result = await (await kv()).get<PricingSettings>(PRICING_SETTINGS_KEY);
  return result.value;
}

export async function savePricingSettings(settings: PricingSettings): Promise<KvCommitResult> {
  return (await kv()).set(PRICING_SETTINGS_KEY, settings);
}

// Marketplace Cache

const MARKETPLACE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function marketplaceCacheKey(idItem: number, colorId: number | null, page: number, loc: string): KvKey {
  return ["marketplace_cache", idItem, colorId ?? "all", page, loc || "any"];
}

export interface MarketplaceCacheEntry {
  data: unknown;
  savedAt: string; // ISO-8601
}

export async function getMarketplaceCache(
  idItem: number,
  colorId: number | null,
  page: number,
  loc: string,
): Promise<{ data: unknown; savedAt: string | null } | null> {
  const result = await (await kv()).get<unknown>(marketplaceCacheKey(idItem, colorId, page, loc));
  const value = result.value;
  if (value === null || value === undefined) return null;
  if (
    typeof value === "object" &&
    "data" in value &&
    "savedAt" in value &&
    typeof (value as MarketplaceCacheEntry).savedAt === "string"
  ) {
    const entry = value as MarketplaceCacheEntry;
    return { data: entry.data, savedAt: entry.savedAt };
  }
  // Legacy raw payload written before entries were wrapped — usable only as stale fallback.
  return { data: value, savedAt: null };
}

export async function saveMarketplaceCache(
  idItem: number,
  colorId: number | null,
  page: number,
  loc: string,
  data: unknown,
): Promise<void> {
  const entry: MarketplaceCacheEntry = { data, savedAt: new Date().toISOString() };
  // Hard 24h expiry bounds KV growth; freshness is judged by savedAt, not expiry.
  await (await kv()).set(marketplaceCacheKey(idItem, colorId, page, loc), entry, {
    expireIn: 24 * 60 * 60 * 1000,
  });
}

export function isMarketplaceCacheFresh(savedAt: string | null, nowMs = Date.now()): boolean {
  return savedAt !== null && nowMs - Date.parse(savedAt) < MARKETPLACE_CACHE_TTL_MS;
}

// Price Guide Cache

const PRICE_GUIDE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function priceGuideCacheKey(
  itemType: string,
  itemNo: string,
  colorId: number | null,
  newOrUsed: string,
  guideType: string,
  countryCode: string,
  currencyCode: string,
): KvKey {
  // Guides are country- and currency-specific, so both belong in the key.
  return [
    "price_guide_cache",
    itemType,
    itemNo.toLowerCase(),
    colorId ?? "all",
    newOrUsed,
    guideType,
    countryCode || "any",
    currencyCode,
  ];
}

export interface PriceGuideCacheEntry {
  guide: BLPriceGuide;
  savedAt: string; // ISO-8601
}

export async function getPriceGuideCache(
  itemType: string,
  itemNo: string,
  colorId: number | null,
  newOrUsed: string,
  guideType: string,
  countryCode: string,
  currencyCode: string,
): Promise<{ guide: BLPriceGuide; savedAt: string } | null> {
  const result = await (await kv()).get<PriceGuideCacheEntry>(
    priceGuideCacheKey(itemType, itemNo, colorId, newOrUsed, guideType, countryCode, currencyCode),
  );
  const value = result.value;
  if (value === null || value === undefined) return null;
  return { guide: value.guide, savedAt: value.savedAt };
}

export async function savePriceGuideCache(
  itemType: string,
  itemNo: string,
  colorId: number | null,
  newOrUsed: string,
  guideType: string,
  countryCode: string,
  currencyCode: string,
  guide: BLPriceGuide,
): Promise<void> {
  const entry: PriceGuideCacheEntry = { guide, savedAt: new Date().toISOString() };
  // Hard 24h expiry bounds KV growth; freshness is judged by savedAt, not expiry.
  await (await kv()).set(
    priceGuideCacheKey(itemType, itemNo, colorId, newOrUsed, guideType, countryCode, currencyCode),
    entry,
    { expireIn: 24 * 60 * 60 * 1000 },
  );
}

export function isPriceGuideCacheFresh(savedAt: string | null, nowMs = Date.now()): boolean {
  return savedAt !== null && nowMs - Date.parse(savedAt) < PRICE_GUIDE_CACHE_TTL_MS;
}

// Store Items Cache

const STORE_ITEMS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function storeItemsCacheKey(itemType: string, itemNo: string, colorId: number | null): KvKey {
  return ["store_items_cache", itemType, itemNo.toLowerCase(), colorId ?? "all"];
}

export async function getStoreItemsCache(
  itemType: string,
  itemNo: string,
  colorId: number | null,
): Promise<unknown[] | null> {
  const result = await (await kv()).get<unknown[]>(storeItemsCacheKey(itemType, itemNo, colorId));
  return result.value;
}

export async function saveStoreItemsCache(
  itemType: string,
  itemNo: string,
  colorId: number | null,
  items: unknown[],
): Promise<void> {
  await (await kv()).set(storeItemsCacheKey(itemType, itemNo, colorId), items, {
    expireIn: STORE_ITEMS_CACHE_TTL_MS,
  });
}

// CRM Customers

function customerKey(buyerName: string): KvKey {
  return ["crm_customer", buyerName];
}

export async function saveCustomer(customer: Customer): Promise<KvCommitResult> {
  return (await kv()).set(customerKey(customer.buyerName), customer);
}

export async function getCustomer(buyerName: string): Promise<Customer | null> {
  const result = await (await kv()).get<Customer>(customerKey(buyerName));
  return result.value;
}

export interface CustomerPage {
  customers: Customer[];
  /** Opaque KV cursor for the next page, or null if this is the last page. */
  nextCursor: string | null;
}

export async function listCustomers(limit = 20, cursor?: string): Promise<CustomerPage> {
  const db = await kv();
  const listOptions: KvListOptions = { limit };
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

// Buyer Index

const BUYER_INDEX_KEY: KvKey = ["crm_buyer_index"];

/** Persist the sorted list of all known buyer names for use in filter UIs. */
export async function saveBuyerIndex(buyers: string[]): Promise<KvCommitResult> {
  return (await kv()).set(
    BUYER_INDEX_KEY,
    [...buyers].sort((a, b) => a.localeCompare(b)),
  );
}

/** Return the sorted list of all known buyer names, or an empty array if not yet built. */
export async function getBuyerIndex(): Promise<string[]> {
  const result = await (await kv()).get<string[]>(BUYER_INDEX_KEY);
  return result.value ?? [];
}

// Order Message Count Cache

function orderMessageCountCacheKey(orderId: number): KvKey {
  return ["order_message_count_cache", orderId];
}

export async function getOrderMessageCountCache(orderId: number): Promise<number | null> {
  const result = await (await kv()).get<number>(orderMessageCountCacheKey(orderId));
  return result.value;
}

export async function saveOrderMessageCountCache(orderId: number, count: number): Promise<KvCommitResult> {
  return (await kv()).set(orderMessageCountCacheKey(orderId), count, { expireIn: 60_000 });
}

// CRM Metadata

const CRM_META_KEY: KvKey = ["crm_meta"];

export async function getCrmMeta(): Promise<CrmMeta | null> {
  const result = await (await kv()).get<CrmMeta>(CRM_META_KEY);
  return result.value;
}

export async function saveCrmMeta(meta: CrmMeta): Promise<KvCommitResult> {
  return (await kv()).set(CRM_META_KEY, meta);
}

// BrickLink Colors Cache

function colorKey(colorId: number): KvKey {
  return ["color", colorId];
}

const COLORS_META_KEY: KvKey = ["colors_meta"];

export async function getColorsMeta(): Promise<ColorsMeta | null> {
  const result = await (await kv()).get<ColorsMeta>(COLORS_META_KEY);
  return result.value;
}

export async function saveColorsMeta(meta: ColorsMeta): Promise<KvCommitResult> {
  return (await kv()).set(COLORS_META_KEY, meta);
}

export async function saveColor(color: BLColor): Promise<KvCommitResult> {
  return (await kv()).set(colorKey(color.color_id), color);
}

export async function getColor(colorId: number): Promise<BLColor | null> {
  const result = await (await kv()).get<BLColor>(colorKey(colorId));
  return result.value;
}

export async function listColors(): Promise<BLColor[]> {
  const entries = (await kv()).list<BLColor>({ prefix: ["color"] });
  const results: BLColor[] = [];
  for await (const entry of entries) {
    results.push(entry.value);
  }
  return results.sort((a, b) => a.color_id - b.color_id);
}

// BrickLink Catalog Search Cache

function bricklinkItemSearchKey(itemId: string): KvKey {
  return ["bricklink_item_search", itemId.toLowerCase()];
}

export async function getBricklinkItemSearch(itemId: string): Promise<BricklinkSearchResult | null> {
  const result = await (await kv()).get<BricklinkSearchResult>(bricklinkItemSearchKey(itemId));
  return result.value;
}

export async function saveBricklinkItemSearch(itemId: string, result: BricklinkSearchResult): Promise<KvCommitResult> {
  return (await kv()).set(bricklinkItemSearchKey(itemId), result);
}

// Drive Thru Template Rules

function templateRuleKey(id: string): KvKey {
  return ["drive_thru_rules", id];
}

const DEFAULT_TEMPLATE_KEY: KvKey = ["drive_thru_default_template"];

export async function listTemplateRules(): Promise<TemplateRule[]> {
  const entries = (await kv()).list<TemplateRule>({ prefix: ["drive_thru_rules"] });
  const results: TemplateRule[] = [];
  for await (const entry of entries) {
    results.push(entry.value);
  }
  return results.sort((a, b) => a.priority - b.priority);
}

export async function getTemplateRule(id: string): Promise<TemplateRule | null> {
  const result = await (await kv()).get<TemplateRule>(templateRuleKey(id));
  return result.value;
}

export async function saveTemplateRule(rule: TemplateRule): Promise<KvCommitResult> {
  return (await kv()).set(templateRuleKey(rule.id), rule);
}

export async function deleteTemplateRule(id: string): Promise<void> {
  return (await kv()).delete(templateRuleKey(id));
}

export async function getDefaultTemplateId(): Promise<string | null> {
  const result = await (await kv()).get<string>(DEFAULT_TEMPLATE_KEY);
  return result.value;
}

export async function setDefaultTemplateId(id: string): Promise<KvCommitResult> {
  return (await kv()).set(DEFAULT_TEMPLATE_KEY, id);
}

// Local Shipping Method Overrides

function orderShippingOverrideKey(orderId: number): KvKey {
  return ["order_shipping_override", orderId];
}

export async function getShippingOverride(orderId: number): Promise<LocalShippingOverride | null> {
  const result = await (await kv()).get<LocalShippingOverride>(orderShippingOverrideKey(orderId));
  return result.value;
}

export async function saveShippingOverride(orderId: number, override: LocalShippingOverride): Promise<KvCommitResult> {
  return (await kv()).set(orderShippingOverrideKey(orderId), override);
}

export async function listShippingOverrides(orderIds: number[]): Promise<Map<number, LocalShippingOverride>> {
  const map = new Map<number, LocalShippingOverride>();
  await Promise.all(
    orderIds.map(async (id) => {
      const override = await getShippingOverride(id);
      if (override) map.set(id, override);
    }),
  );
  return map;
}
