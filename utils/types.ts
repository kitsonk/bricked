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
  | "CANCELLED";

export const UNFULFILLED_STATUSES: OrderStatus[] = [
  "PENDING",
  "UPDATED",
  "PROCESSING",
  "READY",
  "PAID",
  "PACKED",
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

export interface PickListItem {
  itemNo: string;
  itemName: string;
  itemType: string;
  colorId: number;
  colorName: string;
  condition: "N" | "U";
  quantity: number;
  /** Storage location derived from inventory remarks. */
  location: string;
  orderIds: number[];
}
