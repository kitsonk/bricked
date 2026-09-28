import { serveFile } from "jsr:@std/http@^1.1.1/file-server";
import { fromFileUrl } from "jsr:@std/path@^1.1.5";

const clientRoot = new URL("../dist/client/", import.meta.url);

// A static import of the build output cannot work: `deno check` would try to resolve
// `dist/server/entry.mjs`, which does not exist until `deno task build` has run.
const { handle } = await import(new URL("../dist/server/entry.mjs", import.meta.url).href);

const port = Number(Deno.env.get("PORT") ?? 8000);
const hostname = Deno.env.get("HOST") ?? "0.0.0.0";

Deno.serve({ port, hostname }, async (request) => {
  // The adapter's `handle()` is `app.render()` only — it 404s every asset. Serve from dist/client first.
  // `serveFile` answers 405 for any other method, so only GET/HEAD may take this path; otherwise
  // every POST/PUT/DELETE API call would be swallowed before the router ever sees it.
  const { pathname } = new URL(request.url);
  if ((request.method === "GET" || request.method === "HEAD") && !pathname.includes("..")) {
    // "./x" rather than "/x": a leading slash would resolve against the filesystem root.
    const asset = await serveFile(request, fromFileUrl(new URL("." + pathname, clientRoot)));
    if (asset.status !== 404) return asset;
  }
  return handle(request);
});

console.error(`Server running on port ${port}`);
