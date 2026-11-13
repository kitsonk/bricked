import type { APIRoute } from "astro";
import * as route from "@/routes/api/pricing/settings.ts";

export const GET = route.GET satisfies APIRoute;
export const PUT = route.PUT satisfies APIRoute;
