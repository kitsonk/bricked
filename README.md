# bricked

A web application for managing BrickLink stores.

Built with [Node.js](https://nodejs.org) and [Astro](https://astro.build) (server-rendered, with Preact islands for
interactive tables and forms).

### Local Development

Install Node 22.9 or newer (the production host runs Node 26 LTS) and [pnpm](https://pnpm.io):

```sh
corepack enable pnpm
```

Copy `.env.example` to `.env` and fill in your BrickLink API credentials (see
[BrickLink API settings](https://www.bricklink.com/v3/api.page)):

```sh
cp .env.example .env
```

Install dependencies and start the development server:

```sh
pnpm install
pnpm dev
```

Then open <http://localhost:8000> and sign in.

`pnpm dev` and `pnpm start` both load `.env` into the process environment with Node's
`--env-file-if-exists=.env`, so server-side configuration is identical in development and production; variables already
set in the shell take precedence over the file. Astro itself only exposes `.env` through `import.meta.env`, so
server-side code must read `process.env` for this to hold. The dev server binds the same `HOST`/`PORT` defaults as the
production entry point (Astro's `server` config is shared), i.e. `0.0.0.0:8000` unless `PORT`/`HOST` are set.

### Cross-Site Request Forgery Protection

Astro's built-in `security.checkOrigin` compares the `Origin` header to the request URL with a strict equality, and
rejects any form POST that does not match. Some browsers serialise a same-origin navigation as the literal origin `null`
— an opaque-origin context such as a sandboxed frame, an embedded browser, or an automation-driven one — and those
requests were refused with `Cross-site POST form submissions are forbidden`, breaking login and logout.

`middleware/originCheck.ts` replaces it and is composed into the request pipeline in `src/middleware.ts`. It trusts
`Sec-Fetch-Site`, the browser's own statement about the relationship between initiator and request, and falls back to
the `Origin` comparison only for clients that send no Fetch Metadata — where it fails closed. `astro.config.ts` sets
`security.checkOrigin: false` so only one guard runs.

That fallback compares `Origin` to `Astro.url.origin`, so `astro.config.ts` also sets `security.allowedDomains: [{}]`.
`@astrojs/node` ignores the `Host` header unless it matches `allowedDomains` and otherwise pins `Astro.url` to
`localhost:<port>`, which would make every `Origin` comparison fail. Trusting all hosts restores the behaviour of the
previous adapter, which built `Request.url` straight from `Host`.

### Deployment

The app is built with `pnpm build` into `dist/`, and served by `@astrojs/node`'s standalone entry point,
`dist/server/entry.mjs`, which serves `dist/client` first and falls through to the SSR handler. It reads three optional
environment variables:

| Variable  | Default      | Purpose                                  |
| --------- | ------------ | ---------------------------------------- |
| `PORT`    | `8000`       | TCP port to listen on                    |
| `HOST`    | `0.0.0.0`    | Interface to bind                        |
| `KV_PATH` | `kv.sqlite3` | Path to the Deno KV SQLite database file |

Run it directly with:

```sh
pnpm build
pnpm start
```

`pnpm start` is `node --env-file-if-exists=.env dist/server/entry.mjs`.

On the Ubuntu host the app runs as a systemd unit fronted by Tailscale:

```
WorkingDirectory=/home/kitsonk/bricked
ExecStart=/usr/bin/node --env-file-if-exists=.env dist/server/entry.mjs
```

`WorkingDirectory` is what makes the default `kv.sqlite3` and `.env` resolve. The unit sets neither `PORT` nor `HOST`, so
the service listens on the default `8000` — the port Tailscale forwards. Run `systemctl daemon-reload` after editing the
unit, and note that `dist/server/entry.mjs` is a build artefact, so `pnpm build` must run on the host before the service
will boot.

The KV database is a plain SQLite file (`kv.sqlite3` under the working directory by default). It is byte-compatible with
databases Deno itself created, so an existing store can be copied into place before the first Node boot.

### Other Commands

```sh
pnpm build       # Production build
pnpm start       # Serve the production build locally
pnpm dev         # Astro dev server
pnpm check       # Biome check + type check
pnpm fmt         # Biome check with --write (also formats .astro frontmatter and templates)
pnpm lint        # Biome lint only
pnpm test        # Unit tests (Vitest)
pnpm test:smoke  # Route smoke tests — builds, serves, and asserts every page renders
```
