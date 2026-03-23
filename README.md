# bricked

A web application for managing BrickLink stores.

### Local Development

Make sure to install Deno: https://docs.deno.com/runtime/getting_started/installation

Copy `.env.example` to `.env` and fill in your BrickLink API credentials (see [BrickLink API settings](https://www.bricklink.com/v3/api.page)):

```sh
cp .env.example .env
```

Start the development server:

```sh
deno task dev
```

### Deno Deploy

In [Deno Deploy](https://deno.com/deploy), environment variables are configured in the project settings under **Environment Variables**. Add the four variables from `.env.example` there — no `.env` file is needed.

The entry point for deployment is `_fresh/server.js` (produced by `deno task build`).

### Other Commands

```sh
deno task build    # Production build
deno task start    # Serve the production build locally
deno task check    # Format check, lint, and type check
```
