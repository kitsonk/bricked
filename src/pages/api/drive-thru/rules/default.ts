import type { APIRoute } from "astro";
import * as route from "@/routes/api/drive-thru/rules/default.ts";

export const GET = route.GET satisfies APIRoute;
export const PUT = route.PUT satisfies APIRoute;
