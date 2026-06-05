import { page } from "fresh";
import { setCookie } from "@std/http/cookie";
import { define } from "@/utils/fresh.ts";
import {
  AUTH_COOKIE,
  getAuthConfig,
  isAuthEnabled,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifyCredentials,
} from "@/utils/auth.ts";
import { getLogger } from "@/utils/log.ts";

const logger = getLogger(["bricked", "routes", "login"]);

export type LoginData = {
  error: string | null;
  from: string;
  username: string;
  authDisabled: boolean;
};

const SAFE_FROM = /^\/[^/].*$/;

function sanitizeFrom(raw: string | null): string {
  if (!raw) return "/";
  if (raw === "/login") return "/";
  if (!SAFE_FROM.test(raw)) return "/";
  return raw;
}

export const handler = define.handlers<LoginData>({
  GET(ctx) {
    if (ctx.state.user) {
      return new Response(null, { status: 302, headers: { location: "/" } });
    }
    const from = sanitizeFrom(ctx.url.searchParams.get("from"));
    return page({ error: null, from, username: "", authDisabled: !isAuthEnabled() });
  },
  async POST(ctx) {
    const form = await ctx.req.formData();
    const submittedUsername = String(form.get("username") ?? "");
    const submittedPassword = String(form.get("password") ?? "");
    const from = sanitizeFrom(String(form.get("from") ?? "/"));

    const config = getAuthConfig();
    if (!config) {
      logger.warn`Login attempt while auth is disabled`;
      return new Response(null, { status: 302, headers: { location: from } });
    }

    const ok = verifyCredentials(submittedUsername, submittedPassword);
    if (!ok) {
      logger.info`Failed login attempt for user "${submittedUsername}"`;
      return page({ error: "Invalid username or password.", from, username: "", authDisabled: false });
    }

    const token = await signSession(config.username);
    const headers = new Headers({ location: from });
    setCookie(headers, {
      name: AUTH_COOKIE,
      value: token,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: ctx.url.protocol === "https:",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    logger.info`User "${config.username}" signed in`;
    return new Response(null, { status: 302, headers });
  },
});

function LoginForm({ data }: { data: LoginData }) {
  return (
    <div class="flex min-h-screen items-center justify-center bg-base-200 p-4">
      <div class="card w-full max-w-sm border border-base-content/10 bg-base-100 shadow-lg">
        <div class="card-body">
          <div class="mb-2 flex items-center gap-3">
            <img alt="bricked Logo" class="h-9 w-9" src="/logo.svg" />
            <span class="text-xl font-semibold">bricked</span>
          </div>
          <h1 class="card-title text-lg">Sign in</h1>
          <p class="mb-2 text-sm text-base-content/60">
            Enter your credentials to access the dashboard.
          </p>
          {data.authDisabled && (
            <div role="alert" class="alert alert-warning mb-4">
              <span class="iconify lucide--alert-triangle size-5"></span>
              <div class="text-sm">
                Authentication is not configured. Set <code>APP_USERNAME</code>, <code>APP_PASSWORD</code> and{" "}
                <code>SESSION_SECRET</code> to enable login.
              </div>
            </div>
          )}
          {data.error && (
            <div role="alert" class="alert alert-error mb-4">
              <span class="iconify lucide--alert-circle size-5"></span>
              <span class="text-sm">{data.error}</span>
            </div>
          )}
          <form method="POST" class="space-y-3">
            <input type="hidden" name="from" value={data.from} />
            <label class="floating-label">
              <span>Username</span>
              <input
                type="text"
                name="username"
                class="input input-bordered w-full"
                autocomplete="username"
                required
                value={data.username}
              />
            </label>
            <label class="floating-label">
              <span>Password</span>
              <input
                type="password"
                name="password"
                class="input input-bordered w-full"
                autocomplete="current-password"
                required
              />
            </label>
            <button type="submit" class="btn btn-primary w-full">Sign in</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default define.page<typeof handler>(function LoginPage({ data }) {
  return <LoginForm data={data} />;
});
