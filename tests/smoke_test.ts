import { assert, assertEquals } from "jsr:@std/assert@1.0.19";

const repoRoot = new URL("../", import.meta.url);
const entryUrl = new URL("dist/server/entry.mjs", repoRoot);

const DUMMY_BRICKLINK = {
  BRICKLINK_CONSUMER_KEY: "dummy",
  BRICKLINK_CONSUMER_SECRET: "dummy",
  BRICKLINK_TOKEN: "dummy",
  BRICKLINK_TOKEN_SECRET: "dummy",
} as const;

const AUTH_OFF = { APP_USERNAME: "", APP_PASSWORD: "", SESSION_SECRET: "" } as const;

/**
 * One row per page route. `marker` is a literal taken from that page's own template — its heading,
 * error text, or island markup — because the `bricked` shell title and the sidebar labels are shared
 * by every page and would prove nothing. `islands` counts `component-url=` markers, which is what
 * proves an island is hydrated rather than merely server-rendered; the app frame's `SidebarPersist`
 * accounts for one of them on every page that uses it.
 *
 * Routes marked "data-gated" only render their page island on the success path. Under this suite's
 * profile — dummy BrickLink credentials, so the upstream call fails — they render their error or
 * empty branch instead, and `marker` is that branch's text.
 */
const PAGE_ROUTES = [
  { path: "/login", marker: "Sign in", islands: 0 },
  { path: "/", marker: "BrickLink store management", islands: 1 },
  { path: "/environment", marker: "BrickLink API Credentials", islands: 1 },
  { path: "/admin/changelog", marker: "collapse collapse-arrow", islands: 1 },
  { path: "/colors", marker: 'component-url="/_astro/Colors.', islands: 2 },
  { path: "/configuration", marker: ">Sender Address<", islands: 2 },
  { path: "/package-types", marker: 'placeholder="Small box"', islands: 2 },
  { path: "/inventory", marker: "Marketplace Items", islands: 2 },
  { path: "/admin/logs", marker: "Showing latest entries", islands: 2 },
  // The shipping-methods endpoint is not auth-gated, so this page reaches its success branch even
  // with dummy credentials. Assert the template's own heading, which renders in both branches.
  { path: "/shipping-methods", marker: '<h1 class="text-2xl font-bold mb-6">Shipping Methods</h1>', islands: 2 },
  { path: "/drive-thru/rules", marker: "Define rules to automatically select", islands: 2 },
  { path: "/drive-thru/templates", marker: "Templates are used to preview", islands: 2 },
  { path: "/orders", marker: "Failed to load orders", islands: 3 },
  { path: "/customers", marker: "Import Orders from CSV", islands: 2 },
  { path: "/pick-list?orders=1", marker: "Failed to generate pick list", islands: 1 },
  { path: "/ship-list?orders=1", marker: "Failed to load orders", islands: 1 }, // data-gated
  { path: "/print-labels?orders=1", marker: "Shipping Labels", islands: 1 }, // data-gated
  { path: "/orders/1", marker: "Failed to load order", islands: 1 }, // data-gated
  { path: "/customers/testuser", marker: "No cached orders for this buyer.", islands: 1 }, // data-gated
  { path: "/drive-thru/1", marker: ">Drive Thru<", islands: 1 }, // data-gated
] as const;

const STATIC_ASSETS = [
  "/logo.svg",
  "/robots.txt",
  "/favicon.ico",
  "/images/bayside-bricks.jpeg",
] as const;

function freePort(): number {
  const listener = Deno.listen({ port: 0, hostname: "127.0.0.1" });
  const { port } = listener.addr as Deno.NetAddr;
  listener.close();
  return port;
}

/**
 * `dist/` is a build artefact, so build it on demand rather than skipping the suite: these tests are
 * the only thing standing between a migration and twenty routes that return an empty 200.
 */
async function ensureBuild(): Promise<void> {
  try {
    await Deno.stat(entryUrl);
    return;
  } catch {
    // not built yet
  }
  const build = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "--env-file", "npm:astro", "build"],
    cwd: repoRoot,
    stdout: "null",
    stderr: "inherit",
  });
  const { code } = await build.output();
  assertEquals(code, 0, "astro build failed");
  await Deno.stat(entryUrl);
}

interface Server {
  origin: string;
  stop: () => Promise<void>;
}

async function startServer(env: Record<string, string>, kvPath: string): Promise<Server> {
  const port = freePort();
  const child = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "src/serve.ts"],
    cwd: repoRoot,
    env: {
      PORT: String(port),
      HOST: "127.0.0.1",
      // Never let the suite touch the developer's real Deno KV database.
      DENO_KV_PATH: kvPath,
      LOG_LEVEL: "error",
      ...DUMMY_BRICKLINK,
      ...env,
    },
    stdout: "null",
    stderr: "null",
  }).spawn();

  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${origin}/`, { redirect: "manual" });
      return {
        origin,
        stop: async () => {
          child.kill("SIGTERM");
          await child.status;
        },
      };
    } catch {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 100);
      await promise;
    }
  }
  child.kill("SIGKILL");
  throw new Error(`server did not start on ${origin}`);
}

async function withServer(env: Record<string, string>, body: (origin: string) => Promise<void>) {
  const kvPath = await Deno.makeTempDir({ prefix: "bricked-smoke-" });
  const server = await startServer(env, kvPath);
  try {
    await body(server.origin);
  } finally {
    await server.stop();
    await Deno.remove(kvPath, { recursive: true });
  }
}

/**
 * Posts a form body with arbitrary request headers and returns the status code.
 *
 * `fetch` cannot be used for the origin-check tests: `Origin` and `Sec-Fetch-*` are forbidden
 * header names, and Deno's `fetch` strips them before they reach the server, so it can only ever
 * exercise the "no metadata at all" path. A raw socket is the only way to set them.
 */
async function rawPost(
  origin: string,
  path: string,
  headers: Record<string, string>,
  body: string,
): Promise<number> {
  const url = new URL(path, origin);
  const conn = await Deno.connect({ hostname: url.hostname, port: Number(url.port) });
  try {
    const request = [
      `POST ${url.pathname} HTTP/1.1`,
      `Host: ${url.host}`,
      "Content-Type: application/x-www-form-urlencoded",
      "Connection: close",
      ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
      `Content-Length: ${new TextEncoder().encode(body).length}`,
      "",
      body,
    ].join("\r\n");
    await conn.write(new TextEncoder().encode(request));
    const buffer = new Uint8Array(256);
    const read = await conn.read(buffer);
    if (read === null) throw new Error("connection closed before a response arrived");
    return Number(new TextDecoder().decode(buffer.subarray(0, read)).split(" ")[1]);
  } finally {
    conn.close();
  }
}

function countIslands(html: string): number {
  return html.split("component-url=").length - 1;
}

Deno.test("every page route renders its own content and hydrates its islands", async () => {
  await ensureBuild();
  await withServer(AUTH_OFF, async (origin) => {
    for (const route of PAGE_ROUTES) {
      const response = await fetch(`${origin}${route.path}`, { redirect: "manual" });
      assertEquals(response.status, 200, `${route.path} status`);
      const html = await response.text();
      assert(html.includes("<title>bricked</title>"), `${route.path} is missing the shell title`);
      assert(html.includes(route.marker), `${route.path} is missing ${JSON.stringify(route.marker)}`);
      assertEquals(countIslands(html), route.islands, `${route.path} island count`);
    }
  });
});

Deno.test("static assets are served and bot probes are not", async () => {
  await ensureBuild();
  await withServer(AUTH_OFF, async (origin) => {
    for (const asset of STATIC_ASSETS) {
      const response = await fetch(`${origin}${asset}`, { redirect: "manual" });
      assertEquals(response.status, 200, `${asset} status`);
    }
    assertEquals((await fetch(`${origin}/wp-admin`, { redirect: "manual" })).status, 404, "bot probe status");
  });
});

Deno.test("auth gates pages and API routes, and a session cookie unlocks them", async () => {
  await ensureBuild();
  await withServer({
    APP_USERNAME: "tester",
    APP_PASSWORD: "hunter2",
    SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  }, async (origin) => {
    const page = await fetch(`${origin}/orders`, { redirect: "manual" });
    assertEquals(page.status, 302, "unauthenticated page status");
    assertEquals(page.headers.get("location"), "/login?from=%2Forders", "unauthenticated page redirect");

    const api = await fetch(`${origin}/api/orders/1/ship`, { redirect: "manual" });
    assertEquals(api.status, 401, "unauthenticated API status");
    assertEquals(api.headers.get("retry-after"), "86400", "unauthenticated API retry-after");

    const login = await fetch(`${origin}/login`, {
      method: "POST",
      headers: { origin },
      body: new URLSearchParams({ username: "tester", password: "hunter2", from: "/orders" }),
      redirect: "manual",
    });
    assertEquals(login.status, 302, "login status");
    assertEquals(login.headers.get("location"), "/orders", "login redirect");
    const setCookie = login.headers.get("set-cookie") ?? "";
    assert(setCookie.startsWith("bricked_session="), `login did not set a session cookie: ${setCookie}`);

    const authed = await fetch(`${origin}/orders`, {
      headers: { cookie: setCookie.split(";")[0] },
      redirect: "manual",
    });
    assertEquals(authed.status, 200, "authenticated page status");
    assert((await authed.text()).includes("Failed to load orders"), "authenticated page is empty");
  });
});

const AUTH_ENV = {
  APP_USERNAME: "tester",
  APP_PASSWORD: "hunter2",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
} as const;

function loginBody(): string {
  return new URLSearchParams({ username: "tester", password: "hunter2", from: "/orders" }).toString();
}

Deno.test("a same-origin form submit is allowed even when the browser sends origin `null`", async () => {
  await ensureBuild();
  await withServer(AUTH_ENV, async (origin) => {
    // An opaque-origin context (sandboxed frame, embedded or automation browser) makes a
    // same-origin navigation serialise its Origin as the string "null". Astro's built-in check
    // rejected these; ours trusts Sec-Fetch-Site first.
    const status = await rawPost(origin, "/login", { "sec-fetch-site": "same-origin", origin: "null" }, loginBody());
    assertEquals(status, 302, "same-origin submit with origin null");
  });
});

Deno.test("genuinely cross-site form submits are still refused", async () => {
  await ensureBuild();
  await withServer(AUTH_ENV, async (origin) => {
    const refused: { label: string; headers: Record<string, string> }[] = [
      // The real attack shape: a cross-site form navigation. Astro's dev-server guard exempts
      // navigations, so this is the request our check has to catch.
      {
        label: "cross-site navigation",
        headers: { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", origin: "https://evil.example" },
      },
      {
        label: "cross-site navigation, origin null",
        headers: { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", origin: "null" },
      },
      {
        label: "same-site navigation",
        headers: { "sec-fetch-site": "same-site", "sec-fetch-mode": "navigate", origin: "http://sub.localhost" },
      },
      // No Fetch Metadata at all: falls back to the Origin comparison.
      { label: "foreign origin, no sec-fetch-site", headers: { origin: "https://evil.example" } },
      { label: "no origin and no sec-fetch-site", headers: {} },
    ];
    for (const { label, headers } of refused) {
      const status = await rawPost(origin, "/login", headers, loginBody());
      assertEquals(status, 403, `${label} should be refused`);
    }
  });
});
