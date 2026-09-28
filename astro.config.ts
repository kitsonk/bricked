import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import deno from "@deno/astro-adapter";
import tailwindcss from "@tailwindcss/vite";
import { Loader, RequestedModuleType, ResolutionMode, Workspace } from "@jsr/deno__loader";
import type { Plugin } from "vite";

const denoConfig = JSON.parse(readFileSync(new URL("./deno.json", import.meta.url), "utf8")) as {
  imports: Record<string, string>;
};

const jsrImports = Object.entries(denoConfig.imports).filter(([, target]) => target.startsWith("jsr:"));
const JSR_HOST = "https://jsr.io/";

/**
 * JSR modules are handed to Vite as virtual modules so the *client* can load them. A resolved
 * `https://jsr.io/…` id is treated as an external URL and left untouched, so the browser fetches the
 * raw TypeScript and refuses it on MIME type — that broke island hydration for anything reaching
 * `@blaze/human-readable-timestamp` through `utils/format.ts`. A `\0`-prefixed id is served to the
 * browser under `/@id/`, and Vite runs `load` first, so the browser gets transpiled JavaScript.
 */
const VIRTUAL_PREFIX = "\0deno-jsr::";

/**
 * Vite resolves npm packages and relative paths, but knows nothing about `deno.json`'s import map —
 * so the bare specifiers that map to JSR packages (`@logtape/logtape`, `@std/http/cookie`, …) fail
 * to resolve in both `astro dev` and `astro build`. This plugin hands exactly those specifiers to
 * Deno's own resolver and transpiles what comes back, honouring `deno.lock`. Astro's `astro:` and
 * `virtual:` modules are deliberately left alone.
 */
function denoJsrImports(): Plugin {
  let loaderPromise: Promise<Loader> | undefined;

  const loader = () => (loaderPromise ??= new Workspace({
    configPath: fileURLToPath(new URL("./deno.json", import.meta.url)),
  }).createLoader());

  const payload = (id: string) => (id.startsWith(VIRTUAL_PREFIX) ? id.slice(VIRTUAL_PREFIX.length) : null);
  const isDenoId = (id: string) => payload(id) !== null || id.startsWith("jsr:") || id.startsWith(JSR_HOST);
  /** The id to hand to Deno's resolver: the real URL, not the Vite virtual wrapper around it. */
  const denoSource = (id: string) => payload(id) ?? id;
  const isBare = (source: string) => !source.startsWith(".") && !source.startsWith("/");

  /** Graphing a module is what expands a version range from deno.json into a concrete URL. */
  async function graph(denoLoader: Loader, id: string, referrer?: string): Promise<string> {
    let resolved = denoLoader.resolveSync(id, referrer, ResolutionMode.Import);
    if (resolved.startsWith("jsr:") || resolved.startsWith("https:")) {
      await denoLoader.addEntrypoints([resolved]);
      resolved = denoLoader.resolveSync(resolved, referrer, ResolutionMode.Import);
    }
    return resolved;
  }

  return {
    name: "bricked:deno-jsr-imports",
    enforce: "pre",
    async resolveId(source, importer) {
      const denoLoader = await loader();
      const parent = importer === undefined ? null : denoSource(importer);
      // Inside a JSR module every specifier is resolved against that package's own manifest, not
      // against this project's deno.json.
      if (parent !== null && isDenoId(parent)) {
        if (source.startsWith("./") || source.startsWith("../")) {
          const url = new URL(source, parent.slice(0, parent.lastIndexOf("/") + 1)).href;
          return { id: VIRTUAL_PREFIX + url };
        }
        if (isBare(source) && !source.startsWith("jsr:") && !source.startsWith("node:")) {
          return { id: VIRTUAL_PREFIX + await graph(denoLoader, source, parent) };
        }
      }
      if (!source.startsWith("jsr:")) {
        const mapped = jsrImports.find(([specifier]) => source === specifier || source.startsWith(`${specifier}/`));
        if (!mapped) return null;
        const [specifier, target] = mapped;
        source = target + source.slice(specifier.length);
      }
      return { id: VIRTUAL_PREFIX + await graph(denoLoader, source) };
    },
    async load(id) {
      const real = payload(id);
      if (real === null) return null;
      const denoLoader = await loader();
      const resolved = real.startsWith("jsr:") ? await graph(denoLoader, real) : real;
      const result = await denoLoader.load(resolved, RequestedModuleType.Default);
      if (result.kind === "external") return null;
      const decoder = new TextDecoder();
      return {
        code: decoder.decode(result.code),
        map: result.sourceMap ? decoder.decode(result.sourceMap) : null,
      };
    },
  };
}

export default defineConfig({
  output: "server",
  // start:false — the app owns Deno.serve so PORT/HOST are read at runtime, not baked at build.
  adapter: deno({ start: false }),
  integrations: [preact()],
  // Astro 7 defaults compressHTML to "jsx", which strips whitespace between inline elements and
  // silently changes rendered text. "true" is the lossless mode.
  compressHTML: true,
  // Astro's built-in CSRF guard compares `Origin` to the request URL with a strict equality, which
  // rejects the literal origin `null` that a same-origin navigation from an opaque-origin context
  // sends. `middleware/originCheck.ts` runs in its place and trusts `Sec-Fetch-Site` first.
  security: { checkOrigin: false },
  vite: {
    ssr: {
      // Without this the SSR build externalises `@astrojs/preact/server.js`, and the runtime loader
      // then chokes on that package's `astro:preact:opts` virtual import.
      noExternal: ["@astrojs/preact"],
    },
    // Mandatory: deno.json resolves "@/" for `deno check`, Vite resolves modules itself.
    resolve: { alias: { "@/": fileURLToPath(new URL("./", import.meta.url)) } },
    plugins: [denoJsrImports(), tailwindcss()],
  },
});
