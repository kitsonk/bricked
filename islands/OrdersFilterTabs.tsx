export default function OrdersFilterTabs({ filter }: { filter: "unfiled" | "filed" }) {
  return (
    <div role="tablist" class="tabs tabs-border">
      <button
        role="tab"
        type="button"
        class={`tab${filter === "unfiled" ? " tab-active" : ""}`}
        aria-selected={filter === "unfiled"}
        onClick={() => {
          globalThis.location.href = "/orders";
        }}
      >
        Unfiled
      </button>
      <button
        role="tab"
        type="button"
        class={`tab${filter === "filed" ? " tab-active" : ""}`}
        aria-selected={filter === "filed"}
        onClick={() => {
          globalThis.location.href = "/orders?filter=filed&sort=desc";
        }}
      >
        Filed
      </button>
    </div>
  );
}
