# Repository Guidelines

## Project Structure & Module Organization

This is **bricked**, a Deno + Astro 7 web application for managing BrickLink stores. Astro renders every page on the
server; Preact islands hydrate the interactive tables and forms.

| Directory      | Purpose                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `src/pages/`   | Astro file-based routing: `*.astro` page templates and `api/**.ts` endpoint re-exports.        |
| `src/layouts/` | `Shell.astro` (the HTML document) and `Frame.astro` (the app chrome: sidebar, topbar, footer). |
| `src/`         | `middleware.ts` (request pipeline), `serve.ts` (server entry), `env.d.ts` (`App.Locals`).      |
| `routes/`      | Page and API logic — loaders that the `src/pages/` templates call, plus the API handlers.      |
| `islands/`     | Interactive client-side components. Each one is used from exactly one `.astro` file or layout. |
| `components/`  | Shared server-rendered Preact components that hydrate no island of their own.                  |
| `middleware/`  | The logging, banlist, and auth handlers composed by `src/middleware.ts`.                       |
| `utils/`       | Core logic: BrickLink API client, Deno KV helpers, CRM, formatting, logging.                   |
| `assets/`      | Stylesheets and CSS modules imported via `assets/styles.css`.                                  |
| `public/`      | Static assets served as-is at the webroot (favicons, images, logo, `robots.txt`).              |
| `data/`        | Static JSON data (e.g., `changelog.json`).                                                     |
| `tests/`       | Route smoke tests (`deno task test:smoke`).                                                    |

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
deno task dev         # Start the Astro dev server
deno task build       # Production build (outputs `dist/`)
deno task start       # Serve the production build locally (`deno run -A src/serve.ts`)
deno task check       # Run `deno fmt --check`, `deno lint`, and `deno check`
deno task test        # Unit tests (Deno test)
deno task test:smoke  # Route smoke tests: builds if needed, serves, and asserts every page renders
```

`deno check` and `deno lint` cannot read `.astro` files, so `deno fmt` (with `fmt-component`) and `deno task build` are
the only syntax gates for them. Never pass an `.astro` path to `deno check`.

Copy `.env.example` to `.env` and fill in your BrickLink API credentials before running locally.

## Coding Style & Naming Conventions

- **Language**: TypeScript. Runtime is Deno.
- **Line width**: 120 characters (enforced by `deno fmt`).
- **JSX**: Preact. `jsxImportSource: preact` is set via `deno.json` compiler options — no manual pragma needed.
- **Imports**: Use the `@/` alias for project-root-relative paths (e.g., `import { foo } from "@/utils/bar.ts"`).
- **Naming**: Astro/Preact components use PascalCase. Utility files and non-component exports use camelCase. Page
  template files match their URL path.
- **Linting**: `deno lint` with the recommended rule tags. Run `deno task check` before pushing.

## Testing Guidelines

- **Framework**: Deno's built-in test runner (`deno test`).
- **Unit tests**: colocate `*.test.ts` files next to the modules they test (e.g., `utils/html.test.ts`).
- **Route tests**: `tests/smoke_test.ts` builds the app, serves it, and asserts each page's status, a distinctive marker
  from its own template, and its hydrated-island count. Add a row to `PAGE_ROUTES` for any new page.

## Architecture Notes

- **Runtime**: `deno run -A src/serve.ts` owns `Deno.serve`. It serves `dist/client` first and falls through to the
  built Astro handler, which is `app.render()` only. `PORT` (default `8000`) and `HOST` (default `0.0.0.0`) are read at
  runtime, not baked at build time.
- **Request state**: `App.Locals` is declared ambient in `src/env.d.ts`; middleware reads and writes `context.locals`.
- **Middleware order**: logging → origin check → banlist → auth, nested in `src/middleware.ts`. All four always return a
  `Response`, which is what lets them be composed without casts. `middleware/originCheck.ts` replaces Astro's
  `security.checkOrigin`, which refuses the literal origin `null` that some browsers send for a same-origin navigation.
- **Persistence**: Deno KV (`utils/kv.ts`) stores BrickLink credentials and configuration.
- **Cron**: the two daily refreshes are registered from `src/middleware.ts` behind a `globalThis` guard, because Vite
  re-evaluates that module on every HMR update. `utils/log.ts` is guarded the same way.
- **Styling**: Tailwind CSS v4 + DaisyUI v5 + Lucide icons (via Iconify).
