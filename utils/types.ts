export type OrderStatus =
  | "PENDING"
  | "UPDATED"
  | "PROCESSING"
  | "READY"
  | "PAID"
  | "PACKED"
  | "SHIPPED"
  | "RECEIVED"
  | "COMPLETED"
  | "OCR"
  | "NPB"
  | "NPX"
  | "NRS"
  | "NSS"
  | "CANCELLED"
  | "PURGED";

export const FILED_STATUSES: OrderStatus[] = [
  "PENDING",
  "UPDATED",
  "PROCESSING",
  "READY",
  "PAID",
  "PACKED",
  "SHIPPED",
  "RECEIVED",
  "COMPLETED",
  "OCR",
  "NPB",
  "NPX",
  "NRS",
  "NSS",
  "CANCELLED",
];

export interface BLOrder {
  order_id: number;
  date_ordered: string;
  date_status_changed: string;
  buyer_name: string;
  buyer_email: string;
  status: OrderStatus;
  is_invoiced: boolean;
  payment: {
    method: string;
    currency_code: string;
    date_paid: string;
    status: string;
  };
  shipping: {
    method: string;
    method_id: number;
    tracking_no: string;
    tracking_link: string;
    date_shipped: string;
    address: {
      name: { first: string; last: string; full: string };
      address1: string;
      address2: string;
      city: string;
      state: string;
      postal_code: string;
      country_code: string;
    };
  };
  cost: {
    currency_code: string;
    subtotal: string;
    grand_total: string;
    shipping: string;
  };
  disp_cost: {
    currency_code: string;
    subtotal: string;
    grand_total: string;
    shipping: string;
  };
  total_count: number;
  unique_count: number;
  weight: string;
  is_filed: boolean;
  /** Whether BrickLink has recorded a Drive Thru message as sent for this order. */
  drive_thru_sent: boolean;
}

export interface BLOrderItem {
  inv_id: number;
  order_item_no: number;
  item: {
    no: string;
    name: string;
    type: string;
    category_id: number;
  };
  color_id: number;
  color_name: string;
  quantity: number;
  new_or_used: "N" | "U";
  completeness: string;
  unit_price: string;
  unit_price_final: string;
  disp_unit_price: string;
  disp_unit_price_final: string;
  description: string;
  /** The inventory remarks field — used as storage location (bin/box number). */
  remarks: string;
  weight: string;
}

export interface BricklinkCredentials {
  consumerKey: string;
  consumerSecret: string;
  tokenValue: string;
  tokenSecret: string;
}

export type BLNotificationResourceType = "ORDER" | "MESSAGE" | "FEEDBACK";

export interface BLNotification {
  resource_id: number;
  resource_type: BLNotificationResourceType;
  /** The specific event that triggered the notification. */
  notification_type: string;
}

/** A persisted notification with receipt metadata. */
export interface StoredNotification extends BLNotification {
  id: string;
  receivedAt: string;
}

export interface AusPostAddress {
  recipientName: string;
  recipientEmail: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  suburb: string;
  state: string;
  postcode: string;
}

export interface VerifiedAustralianAddress {
  addressLine1: string;
  addressLine2: string | null;
  addressLine3: string | null;
  suburb: string;
  state: string;
  postcode: string;
  fullAddress: string;
}

export interface BLShippingMethod {
  method_id: number;
  name: string;
  note: string;
  insurance: boolean;
  is_default: boolean;
  area: string;
}

export interface ShippingMethodEnrichment {
  hasTracking: boolean;
}

export interface ShippingMethod extends BLShippingMethod {
  enrichment: ShippingMethodEnrichment;
}

export interface DriveThruTemplate {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriveThruSentRecord {
  orderId: number;
  templateId: string | null;
  templateName: string | null;
  sentAt: string;
}

export interface PackageType {
  id: string;
  label: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  createdAt: string;
  updatedAt: string;
}

export interface PickListOrder {
  orderId: number;
  buyerName: string;
  shippingName: string;
  shippingMethod: string;
  status: OrderStatus;
  dateOrdered: string;
}

export interface PickListItem {
  itemNo: string;
  itemName: string;
  itemType: string;
  description: string;
  colorId: number;
  colorName: string;
  condition: "N" | "U";
  quantity: number;
  /** Storage location derived from inventory remarks. */
  location: string;
  orderIds: number[];
  /** Per-order piece quantities, keyed by order ID. */
  orderQuantities: Record<number, number>;
}
