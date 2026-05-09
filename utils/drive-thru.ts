import type { BLOrder, Customer, RuleCondition, TemplateRule } from "@/utils/types.ts";

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

function getFieldValue(order: BLOrder, customer: Customer | null, field: RuleCondition["field"]): string | number {
  switch (field) {
    case "customer_order_count":
      return customer?.orderCount ?? 0;
    case "shipping_method":
      return order.shipping.method;
    case "shipping_method_id":
      return order.shipping.method_id;
    case "order_total":
      return Number(order.disp_cost.grand_total);
    case "item_count":
      return order.total_count;
    case "country_code":
      return order.shipping.address.country_code;
    case "status":
      return order.status;
    default:
      return "";
  }
}

function evaluateCondition(condition: RuleCondition, order: BLOrder, customer: Customer | null): boolean {
  const left = getFieldValue(order, customer, condition.field);
  const right = condition.value;
  const leftStr = String(left);
  const rightStr = String(right);
  const leftNum = Number(left);
  const rightNum = Number(right);

  switch (condition.operator) {
    case "eq":
      return leftStr === rightStr;
    case "ne":
      return leftStr !== rightStr;
    case "gt":
      return leftNum > rightNum;
    case "gte":
      return leftNum >= rightNum;
    case "lt":
      return leftNum < rightNum;
    case "lte":
      return leftNum <= rightNum;
    case "contains":
      return leftStr.toLowerCase().includes(rightStr.toLowerCase());
    default:
      return false;
  }
}

export function evaluateTemplateRules(
  rules: TemplateRule[],
  order: BLOrder,
  customer: Customer | null,
  defaultTemplateId: string | null,
): { templateId: string | null; matchedRule: TemplateRule | null } {
  for (const rule of rules) {
    if (rule.conditions.every((c) => evaluateCondition(c, order, customer))) {
      return { templateId: rule.templateId, matchedRule: rule };
    }
  }
  return { templateId: defaultTemplateId, matchedRule: null };
}
