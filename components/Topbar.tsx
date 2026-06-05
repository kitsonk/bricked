export function Topbar() {
  return (
    <div class="flex h-full w-full items-center justify-between gap-4 px-4">
      <div class="flex items-center gap-3">
        <label
          class="btn btn-square btn-ghost btn-sm group-has-[[id=layout-sidebar-hover-trigger]:checked]/html:hidden"
          aria-label="Toggle sidebar"
          for="layout-sidebar-toggle-trigger"
        >
          <span class="iconify lucide--menu size-5"></span>
        </label>
        <label
          class="btn btn-square btn-ghost btn-sm hidden group-has-[[id=layout-sidebar-hover-trigger]:checked]/html:flex"
          aria-label="Leftmenu toggle"
          for="layout-sidebar-hover-trigger"
        >
          <span class="iconify lucide--menu size-5"></span>
        </label>
      </div>
      <form method="POST" action="/logout">
        <button type="submit" class="btn btn-ghost btn-sm" aria-label="Log out" title="Log out">
          <span class="iconify lucide--log-out size-4"></span>
          <span class="hidden sm:inline">Log out</span>
        </button>
      </form>
    </div>
  );
}
