import type { APIRoute } from "astro";
import * as route from "@/routes/api/ship-list/manifest.ts";

export const POST = route.POST satisfies APIRoute;
