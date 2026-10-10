# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Bricked** is a web application for managing BrickLink stores, built with Node.js, Astro 7 (server-rendered), and
Preact. It supports viewing unfulfilled orders, browsing order items, and generating consolidated pick lists for
fulfillment.

## Commands

```sh
pnpm dev              # Start development server
pnpm build            # Production build (outputs dist/)
pnpm start            # Serve production build
pnpm check            # Biome check + type check
pnpm fmt              # Biome check --write
pnpm lint             # Biome lint
pnpm typecheck        # tsc --noEmit
pnpm test             # Unit tests
pnpm test:smoke       # Route smoke tests (builds, serves, asserts every page renders)
```

## Architecture

**Runtime & Framework:**

- **Node.js** runtime with **Astro 7** for SSR and file-based routing, bundled by **Vite**
- **Preact** with **Preact Signals** for UI and state management
- **`@astrojs/node`** in `standalone` mode — `dist/server/entry.mjs` owns the HTTP server and serves `dist/client`
  static-first with fallthrough to the SSR handler

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
closed when a client sends no Fetch Metadata. That fallback compares against `Astro.url.origin`, so `astro.config.ts`
also sets `security.allowedDomains: [{}]`: `@astrojs/node` ignores the `Host` header unless it matches `allowedDomains`
and otherwise pins `Astro.url` to `localhost:<port>`. `App.Locals` is declared ambient in `src/env.d.ts`. The two daily
refreshes are registered from `src/middleware.ts` behind a `globalThis` guard, because Vite re-evaluates the module on
every HMR update. They run on `node-cron` with an explicit `timezone: "UTC"` — the schedules were UTC under `Deno.cron`,
and node-cron defaults to local time. `utils/log.ts` is guarded the same way.

**Build config:** bare imports of JSR packages (`@logtape/logtape`, `@std/http/cookie`, `@libs/xml`, …) resolve through
`package.json`'s `npm:@jsr/…` aliases, added with `npx jsr add` (which also writes
`@jsr:registry=https://npm.jsr.io` to `.npmrc`). There is no Vite plugin and no Deno resolver in the build. The `@/`
alias is declared in both `tsconfig.json` and the `vite.resolve.alias` block of `astro.config.ts`.

**Styling:** Tailwind CSS v4 + DaisyUI v5 + Lucide icons (via Iconify). Custom CSS lives in `assets/core/` and is
imported via `assets/styles.css`. Tailwind v4's automatic source detection picks up `.astro` templates, so a utility
used only in a template is generated with no extra config.

**Environment:** server-side code reads `process.env` directly. `pnpm dev` and `pnpm start` load `.env` into the process
environment with Node's `--env-file-if-exists=.env` (shell variables take precedence), because Astro only exposes `.env`
through `import.meta.env` — `astro dev` on its own does not populate `process.env`.

**Persistence:** Deno KV (`utils/kv.ts`) stores BrickLink API credentials, CRM data, and configuration. It is opened
through the `@deno/kv` npm package's SQLite backend at `KV_PATH` (default `kv.sqlite3`, relative to the working
directory), which is byte-compatible with databases Deno itself created. `kv()` also installs a minimal
`globalThis.Deno` shim carrying only `Deno.KvU64` and `Deno.Kv`, the two members `@kitsonk/logtape-kv-sink` and
`@kitsonk/kv-toolbox` evaluate before handing back an instance.

**BrickLink API:** `utils/bricklink.ts` implements OAuth 1.0a signing via the Web Crypto API. Credentials come from the
environment. The `remarks` field on order items is the storage location used for pick list generation.

## Key Conventions

- Line width: 120 characters (enforced by Biome; `biome.json` lives at the repo root)
- Biome cannot type-check `.astro` files; it formats and lints their frontmatter and templates, and `pnpm build` is the
  only other syntax gate for them
- JSX: Preact (`jsxImportSource: preact` via compiler options — no manual pragma needed)
- Imports use the `@/` alias for project-root-relative paths
- Sidebar toggle state managed via CSS checkbox (no JS state)
- **Lucide icons:** icons used as static class strings (e.g. `class="iconify lucide--home"`) are detected automatically
  by Tailwind's scanner. Only icons interpolated dynamically (e.g. `lucide--${icon}`) must be added to the
  `@source inline(...)` list in `assets/styles.css` — currently that list covers the `icon` prop in
  `components/Sidebar.tsx` and the icons in `src/layouts/Frame.astro`.
