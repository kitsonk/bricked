const STATUS_COLORS: Record<string, string> = {
  PENDING: "badge-warning",
  UPDATED: "badge-info",
  PROCESSING: "badge-primary",
  READY: "badge-success",
  PAID: "badge-success",
  PACKED: "badge-neutral",
  SHIPPED: "badge-neutral",
};

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" | "md" }) {
  const sizeClass = size === "md" ? "" : `badge-${size}`;
  return (
    <span class={`badge ${sizeClass} ${STATUS_COLORS[status] ?? "badge-ghost"}`}>
      {status}
    </span>
  );
}
