export function ConditionBadge({ condition }: { condition: "N" | "U" }) {
  return (
    <span class={`badge badge-xs ${condition === "N" ? "badge-success" : "badge-warning"}`}>
      {condition === "N" ? "New" : "Used"}
    </span>
  );
}
