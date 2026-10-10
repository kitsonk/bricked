import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  // Standalone: `dist/server/entry.mjs` owns the HTTP server. The adapter has no host/port options in
  // v11 — it reads Astro's `server` config at build time and `PORT`/`HOST` from the environment at
  // runtime, so these pin today's defaults (8000 / 0.0.0.0) while the env contract still wins.
  server: { port: 8000, host: true },
  adapter: node({ mode: "standalone" }),
  integrations: [preact()],
  // Astro 7 defaults compressHTML to "jsx", which strips whitespace between inline elements and
  // silently changes rendered text. "true" is the lossless mode.
  compressHTML: true,
  // Astro's built-in CSRF guard compares `Origin` to the request URL with a strict equality, which
  // rejects the literal origin `null` that a same-origin navigation from an opaque-origin context
  // sends. `middleware/originCheck.ts` runs in its place and trusts `Sec-Fetch-Site` first.
  //
  // `allowedDomains: [{}]` is required for that fallback to work at all: with the default `[]`,
  // `@astrojs/node` refuses to trust the `Host` header and pins `Astro.url` to `localhost:<port>`,
  // so the `Origin` comparison could never match. Trusting every host matches the old adapter, which
  // built `Request.url` straight from `Host` — the app is fronted by a trusted proxy (Tailscale) and
  // is reached under a dynamic hostname.
  security: { checkOrigin: false, allowedDomains: [{}] },
  vite: {
    ssr: {
      // Without this the SSR build externalises `@astrojs/preact/server.js`, and the runtime loader
      // then chokes on that package's `astro:preact:opts` virtual import.
      noExternal: ["@astrojs/preact"],
    },
    resolve: { alias: { "@/": fileURLToPath(new URL("./", import.meta.url)) } },
    plugins: [tailwindcss()],
  },
});
