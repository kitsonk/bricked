import type { BLOrder } from "@/utils/types.ts";

export const TEMPLATE_VARIABLES: { variable: string; description: string }[] = [
  { variable: "{{buyer_name}}", description: "Buyer's username" },
  { variable: "{{buyer_email}}", description: "Buyer's email address" },
  { variable: "{{shipping_first_name}}", description: "Recipient's first name" },
  { variable: "{{shipping_last_name}}", description: "Recipient's last name" },
  { variable: "{{shipping_full_name}}", description: "Recipient's full name" },
  { variable: "{{shipping_method}}", description: "Shipping method" },
  { variable: "{{shipping_date}}", description: "Date the order was shipped" },
  { variable: "{{tracking_no}}", description: "Tracking number" },
  { variable: "{{tracking_link}}", description: "Tracking link URL" },
  { variable: "{{order_id}}", description: "Order number" },
  { variable: "{{order_date}}", description: "Date the order was placed" },
  { variable: "{{total}}", description: "Order total with currency" },
  { variable: "{{item_count}}", description: "Total number of items" },
  { variable: "{{lot_count}}", description: "Number of distinct lots" },
  { variable: "{{status}}", description: "Order status" },
  { variable: "{{payment_status}}", description: "Payment status" },
];

export function interpolate(body: string, order: BLOrder): string {
  return body
    .replaceAll("{{buyer_name}}", order.buyer_name)
    .replaceAll("{{buyer_email}}", order.buyer_email)
    .replaceAll("{{order_id}}", String(order.order_id))
    .replaceAll("{{order_date}}", new Date(order.date_ordered).toLocaleDateString())
    .replaceAll("{{total}}", `${order.disp_cost.currency_code} ${order.disp_cost.grand_total}`)
    .replaceAll("{{item_count}}", String(order.total_count))
    .replaceAll("{{lot_count}}", String(order.unique_count))
    .replaceAll("{{status}}", order.status)
    .replaceAll("{{payment_status}}", order.payment.status)
    .replaceAll("{{shipping_first_name}}", order.shipping.address.name.first)
    .replaceAll("{{shipping_last_name}}", order.shipping.address.name.last)
    .replaceAll("{{shipping_full_name}}", order.shipping.address.name.full)
    .replaceAll("{{shipping_method}}", order.shipping.method)
    .replaceAll(
      "{{shipping_date}}",
      order.shipping.date_shipped ? new Date(order.shipping.date_shipped).toLocaleDateString() : "",
    )
    .replaceAll("{{tracking_no}}", order.shipping.tracking_no)
    .replaceAll("{{tracking_link}}", order.shipping.tracking_link);
}
