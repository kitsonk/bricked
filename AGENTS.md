# Repository Guidelines

## Project Structure & Module Organization

This is **bricked**, a Node.js + Astro 7 web application for managing BrickLink stores. Astro renders every page on the
server; Preact islands hydrate the interactive tables and forms.

| Directory      | Purpose                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `src/pages/`   | Astro file-based routing: `*.astro` page templates and `api/**.ts` endpoint re-exports.        |
| `src/layouts/` | `Shell.astro` (the HTML document) and `Frame.astro` (the app chrome: sidebar, topbar, footer). |
|`src/`|`middleware.ts` (request pipeline), `env.d.ts` (`App.Locals`).|
| `routes/`      | Page and API logic — loaders that the `src/pages/` templates call, plus the API handlers.      |
| `islands/`     | Interactive client-side components. Each one is used from exactly one `.astro` file or layout. |
| `components/`  | Shared server-rendered Preact components that hydrate no island of their own.                  |
| `middleware/`  | The logging, banlist, and auth handlers composed by `src/middleware.ts`.                       |
| `utils/`       | Core logic: BrickLink API client, KV helpers, CRM, formatting, logging.                        |
| `assets/`      | Stylesheets and CSS modules imported via `assets/styles.css`.                                  |
| `public/`      | Static assets served as-is at the webroot (favicons, images, logo, `robots.txt`).              |
| `data/`        | Static JSON data (e.g., `changelog.json`).                                                     |
| `tests/`       | Route smoke tests (`pnpm test:smoke`).                                                         |

### How a page is put together

Each page is split in two. `routes/<p>.ts` exports the page's data type and a `load<Name>(context)` function that
returns the `PageResult<T>` union from `routes/pageResult.ts` — one of `data`, `redirect`, `notFound`, or `response`.
`src/pages/<p>.astro` calls that loader in its frontmatter and unwraps the result; only inside the `data` branch is
`data` bound, which is what stops a page rendering 200 with nothing in it.

An island must be a **direct** child of an `.astro` file or a layout. A `.tsx` component cannot hydrate a nested island,
so anything that renders one has to be `.astro` — that is why `src/layouts/Frame.astro` exists.

API endpoints follow the same split: the handler lives in `routes/api/**` and `src/pages/api/**` re-exports it as an
`APIRoute` because Astro discovers routes by file location.

## Build, Test, and Development Commands

```sh
pnpm install          # Install dependencies
pnpm dev              # Start the Astro dev server
pnpm build            # Production build (outputs `dist/`)
pnpm start            # Serve the production build locally (`node --env-file-if-exists=.env dist/server/entry.mjs`)
pnpm check            # Biome check + `tsc --noEmit`
pnpm fmt              # Biome check --write (formats and fixes)
pnpm lint             # Biome lint
pnpm typecheck        # `tsc --noEmit`
pnpm test             # Unit tests (Vitest)
pnpm test:smoke       # Route smoke tests: builds if needed, serves, and asserts every page renders
```

Biome formats and lints `.astro` frontmatter and templates, and `pnpm build` is the other syntax gate for them. Never
pass an `.astro` path to `tsc`.

Copy `.env.example` to `.env` and fill in your BrickLink API credentials before running locally.

## Coding Style & Naming Conventions

- **Language**: TypeScript. Runtime is Node.js.
- **Line width**: 120 characters (enforced by `biome.json`).
- **JSX**: Preact. `jsxImportSource: preact` is set in `tsconfig.json` — no manual pragma needed.
- **Imports**: Use the `@/` alias for project-root-relative paths (e.g., `import { foo } from "@/utils/bar.ts"`).
- **Naming**: Astro/Preact components use PascalCase. Utility files and non-component exports use camelCase. Page
  template files match their URL path.
- **Linting**: Biome with the `recommended` preset. Run `pnpm check` before pushing.

## Testing Guidelines

- **Framework**: Vitest (`pnpm test`).
- **Unit tests**: colocate `*.test.ts` files next to the modules they test (e.g., `utils/html.test.ts`). They mutate
  `process.env`, which is why `vitest.config.ts` sets `fileParallelism: false`.
- **Route tests**: `tests/smoke_test.ts` builds the app, serves it, and asserts each page's status, a distinctive marker
  from its own template, and its hydrated-island count. Add a row to `PAGE_ROUTES` for any new page.

## Architecture Notes

- **Runtime**: `@astrojs/node` in standalone mode owns the server — `dist/server/entry.mjs` starts it unless
  `ASTRO_NODE_AUTOSTART=disabled`. It serves `dist/client` static-first with fallthrough to the SSR handler, which is
  `app.render()` only. `PORT` (default `8000`) and `HOST` (default `0.0.0.0`) are read at runtime, not baked at build
  time; `astro.config.ts` pins those defaults through Astro's `server` config, because the adapter has no host/port
  options of its own.
- **Request state**: `App.Locals` is declared ambient in `src/env.d.ts`; middleware reads and writes `context.locals`.
- **Environment**: server-side code reads `process.env` directly. `pnpm dev` and `pnpm start` load `.env` into the
  process environment with Node's `--env-file-if-exists=.env` (shell variables win), because Astro only exposes `.env`
  through `import.meta.env`, which is not available to runtime configuration.
- **Middleware order**: logging → origin check → banlist → auth, nested in `src/middleware.ts`. All four always return a
  `Response`, which is what lets them be composed without casts. `middleware/originCheck.ts` replaces Astro's
  `security.checkOrigin`, which refuses the literal origin `null` that some browsers send for a same-origin navigation.
  Its `Origin` fallback compares against `Astro.url.origin`, which is why `security.allowedDomains: [{}]` is set — the
  node adapter otherwise ignores `Host` and pins that origin to `localhost:<port>`.
- **Persistence**: Deno KV (`utils/kv.ts`) stores BrickLink credentials and configuration. It is opened through the
  `@deno/kv` npm package's SQLite backend — `KV_PATH` (default `kv.sqlite3`, relative to the working directory) — and
  `kv()` installs a minimal `globalThis.Deno` shim carrying only `Deno.KvU64` and `Deno.Kv`, which is what
  `@kitsonk/logtape-kv-sink` and `@kitsonk/kv-toolbox` evaluate.
- **Cron**: the two daily refreshes are registered from `src/middleware.ts` behind a `globalThis` guard, because Vite
  re-evaluates that module on every HMR update. They use `node-cron` with an explicit `timezone: "UTC"` (the schedules
  were UTC under `Deno.cron`; node-cron defaults to local time). `utils/log.ts` is guarded the same way.
- **Styling**: Tailwind CSS v4 + DaisyUI v5 + Lucide icons (via Iconify).
