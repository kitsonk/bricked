import type { RespondingMiddleware } from "@/middleware/types.ts";

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);
const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];

/**
 * Whether the browser considers this request to have come from the app itself.
 *
 * `Sec-Fetch-Site` is the browser's own verdict on the relationship between the initiator and the
 * request, and every current browser sends it. `Origin` is not usable on its own: a same-origin
 * navigation from an opaque-origin context (a sandboxed frame, an automation or embedded browser) is
 * serialised as the literal string `"null"`, which never string-matches the request URL. Trusting
 * `Sec-Fetch-Site` first keeps those requests working; `Origin` is only consulted for clients that
 * send no Fetch Metadata at all, and that path fails closed.
 */
function isSameOrigin(request: Request, url: URL): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null) {
    return fetchSite === "same-origin" || fetchSite === "none";
  }
  return request.headers.get("origin") === url.origin;
}

/**
 * CSRF guard replacing Astro's built-in `security.checkOrigin`. Astro compares the `Origin` header
 * to the request URL with a strict equality, so it rejects the `"null"` origin above with
 * `403 Cross-site POST form submissions are forbidden` on a request the browser itself reports as
 * same-origin. Set `security.checkOrigin: false` in `astro.config.ts`; this runs in its place.
 *
 * The scope is Astro's exactly: unsafe methods only, and of those only form-like content types —
 * plus the no-content-type case, which nothing legitimate sends.
 */
export const originCheck: RespondingMiddleware = async (context, next) => {
  const { request, url } = context;
  if (SAFE_METHODS.has(request.method) || isSameOrigin(request, url)) {
    return await next();
  }
  const contentType = request.headers.get("content-type");
  if (contentType === null || FORM_CONTENT_TYPES.some((type) => contentType.toLowerCase().includes(type))) {
    return new Response(`Cross-site ${request.method} form submissions are forbidden`, {
      status: 403,
      headers: { "content-type": "text/plain;charset=UTF-8" },
    });
  }
  return await next();
};
