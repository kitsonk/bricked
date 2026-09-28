import type { APIContext, MiddlewareNext } from "astro";

/**
 * A `MiddlewareHandler` that always answers with a `Response`. Every middleware in this pipeline
 * does, and the narrower return type lets `src/middleware.ts` nest them without a cast.
 */
export type RespondingMiddleware = (context: APIContext, next: MiddlewareNext) => Promise<Response>;
