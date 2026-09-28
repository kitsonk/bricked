import type { APIRoute } from "astro";
import * as route from "@/routes/logout.ts";

export const POST = route.POST satisfies APIRoute;
export const GET = route.GET satisfies APIRoute;
