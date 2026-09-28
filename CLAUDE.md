# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Bricked** is a web application for managing BrickLink stores, built with Deno, Astro 7 (server-rendered), and Preact.
It supports viewing unfulfilled orders, browsing order items, and generating consolidated pick lists for fulfillment.

## Commands

```sh
deno task dev         # Start development server
deno task build       # Production build (outputs dist/)
deno task start       # Serve production build
deno task check       # Format check, lint, and type check
deno task test        # Unit tests
deno task test:smoke  # Route smoke tests (builds, serves, asserts every page renders)
```

## Architecture

**Runtime & Framework:**

- **Deno** runtime with **Astro 7** for SSR and file-based routing, built by **Vite 8**
- **Preact** with **Preact Signals** for UI and state management
- **`@deno/astro-adapter`** with `start: false` — `src/serve.ts` owns `Deno.serve`

**Routing:** Astro discovers routes from `src/pages/`. `*.astro` files are pages; `api/**.ts` files re-export handlers
from `routes/api/**` as `APIRoute` values. Astro route matching is method-agnostic, so a page handles every method.

**Page pattern:** each page is split in two. `routes/<p>.ts` exports the data type plus a `load<Name>(context)` that
returns the `PageResult<T>` union from `routes/pageResult.ts` (`data` | `redirect` | `notFound` | `response`).
`src/pages/<p>.astro` calls the loader in frontmatter and unwraps it:

```astro
---
import Shell from "../layouts/Shell.astro";
import Frame from "../layouts/Frame.astro";
import { loadOrders } from "@/routes/orders/index.ts";

const result = await loadOrders(Astro);
if (result.kind !== "data") {
  if (result.kind === "redirect") return Astro.redirect(result.to);
  if (result.kind === "notFound") return new Response("Not found", { status: 404 });
  return result.response;
}
const { orders, filter, dateSort, error } = result.data;
---
```

`return` from frontmatter is how a page emits a redirect or any non-200 response.

**Layouts:** `src/layouts/Shell.astro` is the HTML document — it imports `assets/styles.css` and renders
`<ClientRouter />` for client-side navigation. `src/layouts/Frame.astro` is the app chrome; its sidebar and topbar carry
`transition:persist` so they survive a client-side navigation instead of being rebuilt and re-hydrated.

**Islands:** interactive components live in `islands/` and stay `.tsx`. Each is used from exactly one page, and each
usage needs an explicit `client:load`. **An island must be a direct child of an `.astro` file or a layout** — a `.tsx`
component cannot hydrate a nested island, so anything rendering one has to be `.astro`. Components that hydrate no
island of their own (`StatusBadge`, `OrderMessageBubble`, `Sidebar`, `Topbar`, `Footer`, the dialog and badge
components) stay `.tsx` and take no `client:*` directive.

**Forms:** `<ClientRouter />` intercepts form submissions, so a form that must produce a full document load — the login
form, anything using `method="dialog"` — carries `data-astro-reload`.

**Middleware:** `src/middleware.ts` nests logging → origin check → banlist → auth. The four handlers in `middleware/`
are typed as `RespondingMiddleware` so they compose without casts. `middleware/originCheck.ts` replaces Astro's
`security.checkOrigin` (set to `false` in `astro.config.ts`), which refuses the literal origin `null` that some browsers
send for a same-origin navigation; ours trusts `Sec-Fetch-Site` first and falls back to comparing `Origin`, failing
closed when a client sends no Fetch Metadata. `App.Locals` is declared ambient in `src/env.d.ts`. The two daily
`Deno.cron` refreshes are registered from `src/middleware.ts` behind a `globalThis` guard, because Vite re-evaluates the
module on every HMR update and a bare `Deno.cron` would throw. `utils/log.ts` is guarded the same way.

**Build config:** Vite knows nothing about `deno.json`'s import map, so `astro.config.ts` carries a small plugin that
hands the JSR-backed specifiers (`@logtape/logtape`, `@std/http/cookie`, …) to Deno's own resolver and transpiles them.
It returns each module as a **virtual id** (`\0deno-jsr::<resolved https url>`), not the bare `https://jsr.io/…` URL: a
resolved https id is treated as external and left alone, so the browser would fetch the raw TypeScript and reject it on
MIME type. This matters because JSR packages reach the client graph — `utils/format.ts` imports
`@blaze/human-readable-timestamp`, and six islands import `utils/format.ts`.

**Styling:** Tailwind CSS v4 + DaisyUI v5 + Lucide icons (via Iconify). Custom CSS lives in `assets/core/` and is
imported via `assets/styles.css`. Tailwind v4's automatic source detection picks up `.astro` templates, so a utility
used only in a template is generated with no extra config.

**Persistence:** Deno KV (`utils/kv.ts`) stores BrickLink API credentials, CRM data, and configuration. KV requires
`"unstable": ["kv"]` in `deno.json` in addition to `"deno.unstable"` in `compilerOptions.lib` (types only).

**BrickLink API:** `utils/bricklink.ts` implements OAuth 1.0a signing via the Web Crypto API. Credentials come from the
environment. The `remarks` field on order items is the storage location used for pick list generation.

## Key Conventions

- Line width: 120 characters (enforced by `deno fmt`)
- `deno check` and `deno lint` cannot read `.astro` files; `deno fmt` (with `fmt-component`) and `deno task build` are
  the only syntax gates for them
- JSX: Preact (`jsxImportSource: preact` via compiler options — no manual pragma needed)
- Imports use the `@/` alias for project-root-relative paths
- Sidebar toggle state managed via CSS checkbox (no JS state)
- **Lucide icons:** icons used as static class strings (e.g. `class="iconify lucide--home"`) are detected automatically
  by Tailwind's scanner. Only icons interpolated dynamically (e.g. `lucide--${icon}`) must be added to the
  `@source inline(...)` list in `assets/styles.css` — currently that list covers the `icon` prop in
  `components/Sidebar.tsx` and the icons in `src/layouts/Frame.astro`.
