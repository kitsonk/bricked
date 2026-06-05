const EXEMPT_PATHS: ReadonlySet<string> = new Set([
  "/login",
  "/api/notifications",
]);

const EXEMPT_PREFIXES: readonly string[] = [
  "/_frsh/",
  "/static/",
  "/assets/",
  "/favicon",
  "/logo",
  "/robots.txt",
];

const STATIC_EXTENSIONS = new Set([
  ".js",
  ".css",
  ".map",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".json",
  ".txt",
  ".webmanifest",
]);

export function isExemptPath(pathname: string): boolean {
  if (EXEMPT_PATHS.has(pathname)) return true;
  for (const prefix of EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  const lastDot = pathname.lastIndexOf(".");
  const lastSlash = pathname.lastIndexOf("/");
  if (lastDot > lastSlash) {
    const ext = pathname.slice(lastDot);
    if (STATIC_EXTENSIONS.has(ext.toLowerCase())) return true;
  }
  return false;
}

const BOT_PROBE_PATHS: ReadonlySet<string> = new Set([
  "/.env",
  "/.env.local",
  "/.env.production",
  "/.git",
  "/.git/HEAD",
  "/.git/config",
  "/.svn",
  "/.hg",
  "/.vscode",
  "/.idea",
  "/wp-admin",
  "/wp-admin/",
  "/wp-login.php",
  "/wp-config.php",
  "/wp-config.php.bak",
  "/wp-content",
  "/wp-includes",
  "/admin.php",
  "/administrator",
  "/administrator/",
  "/phpmyadmin",
  "/phpmyadmin/",
  "/pma",
  "/xmlrpc.php",
  "/cgi-bin",
  "/cgi-bin/",
  "/server-status",
  "/server-info",
  "/.well-known/security.txt",
  "/.DS_Store",
  "/backup",
  "/backup.sql",
  "/database.sql",
  "/dump.sql",
  "/.htaccess",
  "/.htpasswd",
  "/config.php",
  "/config.bak",
  "/web.config",
  "/crossdomain.xml",
  "/.well-known/openid-configuration",
  "/_profiler",
  "/_profiler/empty/search/results",
  "/debug/default/view",
  "/elmah.axd",
  "/vendor",
  "/vendor/autoload.php",
  "/composer.json",
  "/composer.lock",
  "/package.json",
  "/package-lock.json",
  "/Gemfile",
  "/Gemfile.lock",
  "/.bash_history",
  "/.ssh",
  "/.aws/credentials",
  "/.docker/config.json",
  "/telescope",
  "/telescope/requests",
  "/graphql",
  "/graphiql",
  "/api/swagger",
  "/swagger",
  "/swagger.json",
  "/api-docs",
  "/actuator",
  "/actuator/env",
  "/api/v1",
]);

export function isBotProbe(pathname: string): boolean {
  if (BOT_PROBE_PATHS.has(pathname)) return true;
  return false;
}
