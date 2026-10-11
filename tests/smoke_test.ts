import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, expect, test } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const entryPath = join(repoRoot, "dist", "server", "entry.mjs");

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
  { path: "/admin/restore", marker: "Import NDJSON Export", islands: 2 },
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

const STATIC_ASSETS = ["/logo.svg", "/robots.txt", "/favicon.ico", "/images/bayside-bricks.jpeg"] as const;

/** Ask the kernel for an unused port by binding to 0 and reading back what it assigned. */
function freePort(): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    server.close(() => resolve(port));
  });
  return promise;
}

/**
 * `dist/` is a build artefact, so build it on demand rather than skipping the suite: these tests are
 * the only thing standing between a migration and twenty routes that return an empty 200.
 */
function ensureBuild(): void {
  if (existsSync(entryPath)) return;
  const build = spawnSync("pnpm", ["build"], { cwd: repoRoot, stdio: ["ignore", "ignore", "inherit"] });
  expect(build.status, "astro build failed").toEqual(0);
  expect(existsSync(entryPath)).toBeTruthy();
}

interface Server {
  origin: string;
  stop: () => Promise<void>;
}

async function startServer(env: Record<string, string>, kvPath: string): Promise<Server> {
  const port = await freePort();
  const child = spawn(process.execPath, [entryPath], {
    cwd: repoRoot,
    env: {
      PORT: String(port),
      HOST: "127.0.0.1",
      // Never let the suite touch the developer's real KV database.
      KV_PATH: join(kvPath, "kv.sqlite3"),
      LOG_LEVEL: "error",
      ...DUMMY_BRICKLINK,
      ...env,
    },
    stdio: "ignore",
  });

  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      await fetch(origin, { redirect: "manual" });
      return { origin, stop: () => stopServer(child) };
    } catch {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 100);
      await promise;
    }
  }
  child.kill("SIGKILL");
  throw new Error(`server did not start on ${origin}`);
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const escalation = setTimeout(() => child.kill("SIGKILL"), 5_000);
  try {
    await exited;
  } finally {
    clearTimeout(escalation);
  }
}

async function withServer(env: Record<string, string>, body: (origin: string) => Promise<void>) {
  const kvPath = mkdtempSync(join(tmpdir(), "bricked-smoke-"));
  const server = await startServer(env, kvPath);
  try {
    await body(server.origin);
  } finally {
    await server.stop();
    rmSync(kvPath, { recursive: true, force: true });
  }
}

/**
 * Posts a form body with arbitrary request headers and returns the status code.
 *
 * `fetch` cannot be used for the origin-check tests: `Origin` and `Sec-Fetch-*` are forbidden
 * header names, and Node's `fetch` (undici) strips them before they reach the server, so it can only
 * ever exercise the "no metadata at all" path. A raw socket is the only way to set them.
 */
async function rawPost(origin: string, path: string, headers: Record<string, string>, body: string): Promise<number> {
  const url = new URL(path, origin);
  const socket = createConnection({ host: url.hostname, port: Number(url.port) });
  try {
    await once(socket, "connect");
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
    socket.write(request);

    // The status line is all we need; stop reading as soon as the first line is complete.
    let response = "";
    for await (const chunk of socket) {
      response += chunk.toString("utf8");
      if (response.includes("\r\n")) break;
    }
    const statusLine = response.slice(0, response.indexOf("\r\n"));
    return Number(statusLine.split(" ")[1]);
  } finally {
    socket.destroy();
  }
}

test("every page route renders its own content and hydrates its islands", async () => {
  ensureBuild();
  await withServer(AUTH_OFF, async (origin) => {
    for (const route of PAGE_ROUTES) {
      const response = await fetch(`${origin}${route.path}`, { redirect: "manual" });
      expect(response.status, `${route.path} status`).toEqual(200);
      const html = await response.text();
      assert(html.includes("<title>bricked</title>"), `${route.path} is missing the shell title`);
      assert(html.includes(route.marker), `${route.path} is missing ${JSON.stringify(route.marker)}`);
      expect(html.split("component-url=").length - 1, `${route.path} island count`).toEqual(route.islands);
    }
  });
});

test("static assets are served and bot probes are not", async () => {
  ensureBuild();
  await withServer(AUTH_OFF, async (origin) => {
    for (const asset of STATIC_ASSETS) {
      const response = await fetch(`${origin}${asset}`, { redirect: "manual" });
      expect(response.status, `${asset} status`).toEqual(200);
    }
    expect((await fetch(`${origin}/wp-admin`, { redirect: "manual" })).status, "bot probe status").toEqual(404);
  });
});

test("auth gates pages and API routes, and a session cookie unlocks them", async () => {
  ensureBuild();
  await withServer(
    {
      APP_USERNAME: "tester",
      APP_PASSWORD: "hunter2",
      SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    },
    async (origin) => {
      const page = await fetch(`${origin}/orders`, { redirect: "manual" });
      expect(page.status, "unauthenticated page status").toEqual(302);
      expect(page.headers.get("location"), "unauthenticated page redirect").toEqual("/login?from=%2Forders");

      const api = await fetch(`${origin}/api/orders/1/ship`, { redirect: "manual" });
      expect(api.status, "unauthenticated API status").toEqual(401);
      expect(api.headers.get("retry-after"), "unauthenticated API retry-after").toEqual("86400");

      const login = await fetch(`${origin}/login`, {
        method: "POST",
        headers: { origin },
        body: new URLSearchParams({ username: "tester", password: "hunter2", from: "/orders" }),
        redirect: "manual",
      });
      expect(login.status, "login status").toEqual(302);
      expect(login.headers.get("location"), "login redirect").toEqual("/orders");
      const setCookie = login.headers.get("set-cookie") ?? "";
      assert(setCookie.startsWith("bricked_session="), `login did not set a session cookie: ${setCookie}`);

      const authed = await fetch(`${origin}/orders`, {
        headers: { cookie: setCookie.split(";")[0] },
        redirect: "manual",
      });
      expect(authed.status, "authenticated page status").toEqual(200);
      assert((await authed.text()).includes("Failed to load orders"), "authenticated page is empty");
    },
  );
});

const AUTH_ENV = {
  APP_USERNAME: "tester",
  APP_PASSWORD: "hunter2",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
} as const;

function loginBody(): string {
  return new URLSearchParams({ username: "tester", password: "hunter2", from: "/orders" }).toString();
}

test("a same-origin form submit is allowed even when the browser sends origin `null`", async () => {
  ensureBuild();
  await withServer(AUTH_ENV, async (origin) => {
    // An opaque-origin context (sandboxed frame, embedded or automation browser) makes a
    // same-origin navigation serialise its Origin as the string "null". Astro's built-in check
    // rejected these; ours trusts Sec-Fetch-Site first.
    const status = await rawPost(origin, "/login", { "sec-fetch-site": "same-origin", origin: "null" }, loginBody());
    expect(status, "same-origin submit with origin null").toEqual(302);
  });
});

test("genuinely cross-site form submits are still refused", async () => {
  ensureBuild();
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
      expect(status, `${label} should be refused`).toEqual(403);
    }
  });
});
