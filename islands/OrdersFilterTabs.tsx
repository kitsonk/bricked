export default function OrdersFilterTabs({ filter }: { filter: "unfiled" | "filed" }) {
  return (
    <div role="tablist" class="tabs tabs-border">
      <a
        role="tab"
        href="/orders"
        {...{ "f-partial": "/partials/orders" }}
        class={`tab${filter === "unfiled" ? " tab-active" : ""}`}
        aria-selected={filter === "unfiled"}
      >
        Unfiled
      </a>
      <a
        role="tab"
        href="/orders?filter=filed&sort=desc"
        {...{ "f-partial": "/partials/orders" }}
        class={`tab${filter === "filed" ? " tab-active" : ""}`}
        aria-selected={filter === "filed"}
      >
        Filed
      </a>
    </div>
  );
}
