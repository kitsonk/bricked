# bricked

A web application for managing BrickLink stores.

Built with [Deno](https://deno.com) and [Astro](https://astro.build) (server-rendered, with Preact islands for
interactive tables and forms).

### Local Development

Make sure to install Deno: https://docs.deno.com/runtime/getting_started/installation

Copy `.env.example` to `.env` and fill in your BrickLink API credentials (see
[BrickLink API settings](https://www.bricklink.com/v3/api.page)):

```sh
cp .env.example .env
```

Start the development server:

```sh
deno task dev
```

Then open <http://localhost:4321> and sign in.

### Cross-Site Request Forgery Protection

Astro's built-in `security.checkOrigin` compares the `Origin` header to the request URL with a strict equality, and
rejects any form POST that does not match. Some browsers serialise a same-origin navigation as the literal origin `null`
— an opaque-origin context such as a sandboxed frame, an embedded browser, or an automation-driven one — and those
requests were refused with `Cross-site POST form submissions are forbidden`, breaking login and logout.

`middleware/originCheck.ts` replaces it and is composed into the request pipeline in `src/middleware.ts`. It trusts
`Sec-Fetch-Site`, the browser's own statement about the relationship between initiator and request, and falls back to
the `Origin` comparison only for clients that send no Fetch Metadata — where it fails closed. `astro.config.ts` sets
`security.checkOrigin: false` so only one guard runs.

### Deployment

The app is built with `deno task build` into `dist/`, and served by `src/serve.ts`, which owns `Deno.serve`. It reads
two optional environment variables:

| Variable | Default   | Purpose               |
| -------- | --------- | --------------------- |
| `PORT`   | `8000`    | TCP port to listen on |
| `HOST`   | `0.0.0.0` | Interface to bind     |

Run it directly with:

```sh
deno task build
deno task start
```

On the Ubuntu host the app runs as a systemd unit fronted by Tailscale:

```
ExecStart=/home/kitsonk/.deno/bin/deno run -A --env-file /home/kitsonk/bricked/src/serve.ts
```

`--env-file` is Deno's optional-value flag: with no `=` it loads the default `.env` and treats the following path as the
script argument. The unit sets neither `PORT` nor `HOST`, so the service listens on the default `8000` — the port
Tailscale forwards. Run `systemctl daemon-reload` after editing the unit, and note that `src/serve.ts` imports
`dist/server/entry.mjs` at startup, so `deno task build` must run on the host before the service will boot.

### Other Commands

```sh
deno task build       # Production build
deno task start       # Serve the production build locally
deno task check       # Format check, lint, and type check
deno task test        # Unit tests
deno task test:smoke  # Route smoke tests — builds, serves, and asserts every page renders
```
