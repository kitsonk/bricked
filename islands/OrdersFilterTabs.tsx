export default function OrdersFilterTabs({ filter }: { filter: "unfulfilled" | "all" }) {
  return (
    <div role="tablist" class="tabs tabs-border">
      <button
        role="tab"
        type="button"
        class={`tab${filter === "unfulfilled" ? " tab-active" : ""}`}
        aria-selected={filter === "unfulfilled"}
        onClick={() => {
          globalThis.location.href = "/orders";
        }}
      >
        Unfulfilled
      </button>
      <button
        role="tab"
        type="button"
        class={`tab${filter === "all" ? " tab-active" : ""}`}
        aria-selected={filter === "all"}
        onClick={() => {
          globalThis.location.href = "/orders?filter=all";
        }}
      >
        All Orders
      </button>
    </div>
  );
}
