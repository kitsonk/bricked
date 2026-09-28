import type { APIRoute } from "astro";
import * as route from "@/routes/api/marketplace/index.ts";

export const GET = route.GET satisfies APIRoute;
