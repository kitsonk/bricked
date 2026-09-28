import type { APIRoute } from "astro";
import * as route from "@/routes/api/drive-thru/rules/index.ts";

export const GET = route.GET satisfies APIRoute;
export const POST = route.POST satisfies APIRoute;
