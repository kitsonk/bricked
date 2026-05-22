# Repository Guidelines

## Project Structure & Module Organization

This is **bricked**, a Deno + Fresh v2 web application for managing BrickLink stores.

| Directory     | Purpose                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `routes/`     | File-based routing. API routes live in `routes/api/`. Partials live in `routes/partials/` for SPA-style navigation. |
| `islands/`    | Interactive client-side components hydrated by Fresh.                                                               |
| `components/` | Shared server-rendered components (`AppFrame.tsx`, `Sidebar.tsx`, etc.).                                            |
| `utils/`      | Core logic: BrickLink API client, Deno KV helpers, CRM, formatting, logging.                                        |
| `assets/`     | Stylesheets and CSS modules imported via `assets/styles.css`.                                                       |
| `static/`     | Static assets served as-is (favicons, images, logo).                                                                |
| `data/`       | Static JSON data (e.g., `changelog.json`).                                                                          |

## Build, Test, and Development Commands

```sh
deno task dev      # Start the Vite dev server
deno task build    # Production build (outputs `_fresh/server.js`)
deno task start    # Serve the production build locally
deno task check    # Run `deno fmt --check`, `deno lint`, and `deno check`
deno task test     # Run the test suite (Deno test)
deno task update   # Update Fresh framework dependencies
```

Copy `.env.example` to `.env` and fill in your BrickLink API credentials before running locally.

## Coding Style & Naming Conventions

- **Language**: TypeScript. Runtime is Deno.
- **Line width**: 120 characters (enforced by `deno fmt`).
- **JSX**: Preact. `/** @jsxImportSource preact */` is set via `deno.json` compiler options — no manual pragma needed.
- **Imports**: Use the `@/` alias for project-root-relative paths (e.g., `import { foo } from "@/utils/bar.ts"`).
- **Naming**: React/Preact components use PascalCase. Utility files and non-component exports use camelCase. Route files
  match their URL path.
- **Linting**: `deno lint` with Fresh and recommended rule tags. Run `deno task check` before pushing.

## Testing Guidelines

- **Framework**: Deno's built-in test runner (`deno test`).
- **Coverage**: There is no test suite currently. When adding tests, colocate `*.test.ts` files next to the modules they
  test (e.g., `utils/html.test.ts`).
- **Run tests**: `deno task test` or `deno test --allow-env`.

## Commit & Pull Request Guidelines

- **Commit messages**: Write descriptive, sentence-case summaries. Use the body to explain _why_ and _what_ for
  non-trivial changes. Example:
  ```
  Add Drive Thru template selection rules with auto-evaluation

  - Introduce TemplateRule and RuleCondition types
  - Persist rules and default template ID in Deno KV
  - Add evaluateTemplateRules engine with eq/ne/gt/gte/lt/lte/contains operators
  ```
- **PRs**: Include a clear description of the change, the motivation, and any manual testing steps. Link related issues
  if applicable.

## Architecture Notes

- **SSR / Partials**: The app uses Fresh v2 partials for SPA-like navigation. `AppFrame` wraps pages in
  `<Partial name="main">`. Every page with a partial must export a named data type and a named content component.
- **State management**: Preact Signals inside islands. Shared server state is typed in `utils/fresh.ts`.
- **Persistence**: Deno KV (`utils/kv.ts`) stores BrickLink credentials and configuration.
- **Logging**: Logtape (`utils/log.ts`). Log level controlled via `LOG_LEVEL` env variable.
- **Styling**: Tailwind CSS v4 + DaisyUI v5 + Lucide icons (via Iconify).
