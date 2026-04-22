function MenuItem(
  { icon, label, href, fPartial }: { icon: string; label: string; href: string; fPartial?: string },
) {
  return (
    <a class="menu-item" href={href} {...(fPartial ? { "f-partial": fPartial } : {})}>
      <span class={`iconify lucide--${icon} size-4`}></span>
      <span class="grow">{label}</span>
    </a>
  );
}

export function Sidebar() {
  return (
    <div class="flex h-full w-full flex-col py-3">
      <div class="flex min-h-10 items-center gap-3 px-5">
        <img alt="bricked Logo" class="h-7 w-7" src="/logo.svg" />
        <hr class="border-base-300 h-5 border-e" />
        <span class="text-xl font-semibold">bricked</span>
      </div>
      <div class="sidebar-menu grow overflow-auto px-2.5">
        <label
          for="layout-sidebar-hover-trigger"
          title="Toggle sidebar hover"
          class="btn btn-circle btn-ghost btn-sm text-base-content/50 absolute inset-e-2 top-3.5 max-lg:hidden"
        >
          <span class="iconify lucide--panel-left-close absolute size-4.5 opacity-100 transition-all duration-300 group-has-[[id=layout-sidebar-hover-trigger]:checked]/html:opacity-0">
          </span>
          <span class="iconify lucide--panel-left-dashed absolute size-4.5 opacity-0 transition-all duration-300 group-has-[[id=layout-sidebar-hover-trigger]:checked]/html:opacity-100">
          </span>
        </label>
        <p class="menu-label mt-2 px-2.5">Workflow</p>
        <div class="mt-2">
          <MenuItem icon="house" label="Home" href="/orders" fPartial="/partials/orders" />
          <MenuItem icon="shopping-bag" label="Orders" href="/orders" fPartial="/partials/orders" />
          <MenuItem icon="warehouse" label="Inventory" href="/inventory" fPartial="/partials/inventory" />
          <MenuItem icon="users" label="Customers" href="/customers" fPartial="/partials/customers" />
        </div>
        <p class="menu-label mt-4 px-2.5">Settings</p>
        <div class="mt-2">
          <MenuItem icon="settings" label="Environment" href="/environment" fPartial="/partials/environment" />
          <MenuItem
            icon="truck"
            label="Shipping Methods"
            href="/shipping-methods"
            fPartial="/partials/shipping-methods"
          />
          <MenuItem icon="package" label="Package Types" href="/package-types" fPartial="/partials/package-types" />
          <MenuItem icon="palette" label="Colors" href="/colors" fPartial="/partials/colors" />
          <MenuItem
            icon="send"
            label="Drive Thru Templates"
            href="/drive-thru/templates"
            fPartial="/partials/drive-thru/templates"
          />
        </div>
        <p class="menu-label mt-4 px-2.5">Admin</p>
        <div class="mt-2">
          <MenuItem icon="scroll" label="Logs" href="/admin/logs" fPartial="/partials/admin/logs" />
          <MenuItem icon="history" label="Change Log" href="/admin/changelog" fPartial="/partials/admin/changelog" />
        </div>
      </div>
    </div>
  );
}
