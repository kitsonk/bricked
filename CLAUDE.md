# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Bricked** is a web application for managing BrickLink stores, built with Deno, Fresh v2 (SSR framework), and Preact.
It supports viewing unfulfilled orders, browsing order items, and generating consolidated pick lists for fulfillment.

## Commands

```sh
deno task dev      # Start development server
deno task build    # Production build
deno task start    # Serve production build
deno task check    # Format check, lint, and type check
```

There are no tests currently.

## Architecture

**Runtime & Framework:**

- **Deno** runtime with **Fresh v2** for SSR and file-based routing
- **Preact** with **Preact Signals** for UI and state management
- **Vite** as the bundler/dev server (via `fresh-plugin-vite`)

**Routing:** Fresh file-based routing under `routes/`. API routes live in `routes/api/`. The `_app.tsx` is the root
layout wrapper. Partial routes live in `routes/partials/` — see the Partials section below.

**Islands:** Interactive client-side components go in `islands/` — Fresh's island architecture hydrates only these
components on the client.

**Layout:** `components/AppFrame.tsx` is the main layout wrapper containing the sidebar, topbar, and footer. Pages use
this component to get the standard app chrome. It has `f-client-nav` enabled and wraps content in
`<Partial name="main">`, enabling SPA-style navigation without full page reloads.

**Styling:** Tailwind CSS v4 + DaisyUI v5 + Lucide icons (via Iconify). Custom CSS modules live in `assets/core/` and
are imported via `assets/styles.css`. The `@/` alias maps to the project root.

**Middleware:** `middleware/logging.ts` logs all requests with performance timing. Shared request state is typed in
`utils/fresh.ts`.

**Logging:** Uses Logtape (`utils/log.ts`). Log level controlled via `LOG_LEVEL` env variable.

**Persistence:** Deno KV (`utils/kv.ts`) stores BrickLink API credentials. KV requires `"unstable": ["kv"]` in
`deno.json` (runtime flag) in addition to `"deno.unstable"` in `compilerOptions.lib` (type checking only).

**BrickLink API:** `utils/bricklink.ts` implements OAuth 1.0a signing via the Web Crypto API. Credentials (consumer
key/secret, token/secret) are entered via `/settings` and stored in KV. The `remarks` field on order items is used as
the storage location for pick list generation.

## Partials

The app uses Fresh v2 partials for SPA-like navigation. `AppFrame` has `f-client-nav` on its root element and wraps page
content in `<Partial name="main">`. Clicking any internal link swaps only the content region without reloading the page
shell (sidebar, topbar, footer). Direct URL navigation (deep linking) still works — the full page is served.

**Page route pattern** — every page route that has a corresponding partial must:

1. Export a named data type (e.g. `export type OrdersData = { ... }`)
2. Export a named content component (e.g. `export function OrdersContent({ data }: { data: OrdersData }) { ... }`)
3. Wrap that component in `<AppFrame>` in the default export

**Partial route pattern** — `routes/partials/<same-path>.tsx`:

- `export { handler }` re-exported from the full route (share handler, no duplication)
- `export const config: RouteConfig = { skipAppWrapper: true, skipInheritedLayouts: true }`
- Default export renders `<Partial name="main"><XContent data={data} /></Partial>`
- Import `Partial` from `"fresh/runtime"` and `RouteConfig` from `"fresh"`

**Sidebar links** — `components/Sidebar.tsx` `MenuItem` accepts an `fPartial` prop that renders as the `f-partial`
attribute, telling Fresh to fetch from the lean partial route instead of the full page on in-app navigation.

**Links inside islands** — do NOT use `e.stopPropagation()` on `<a>` tags, as this prevents clicks from bubbling up to
the `f-client-nav` listener. Instead, guard row-click handlers with
`if ((e.target as HTMLElement).closest("a, input, button")) return;`

## Key Conventions

- Line width: 120 characters (enforced by `deno fmt`)
- JSX: Preact (`/** @jsxImportSource preact */` via compiler options — no manual pragma needed)
- Imports use the `@/` alias for project-root-relative paths
- Sidebar toggle state managed via CSS checkbox (no JS state)
- **Fresh v2 data passing:** Use `page(data)` imported from `"fresh"` to pass data from a handler to the page component.
  Do NOT use `ctx.render(data)` — in Fresh v2, `ctx.render()` takes a `VNode`, not arbitrary data. Pattern: handler
  calls `return page({ ... })`, page is defined as `define.page<typeof handler>(({ data }) => ...)`.
- **Lucide icons:** New icons must be added to the `@source inline(...)` list in `assets/styles.css` or they will not be
  included in the CSS bundle.
