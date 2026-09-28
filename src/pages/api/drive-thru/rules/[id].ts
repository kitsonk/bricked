import type { APIRoute } from "astro";
import * as route from "@/routes/api/drive-thru/rules/[id].ts";

export const GET = route.GET satisfies APIRoute;
export const PUT = route.PUT satisfies APIRoute;
export const DELETE = route.DELETE satisfies APIRoute;
