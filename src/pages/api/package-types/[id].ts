import type { APIRoute } from "astro";
import * as route from "@/routes/api/package-types/[id].ts";

export const PUT = route.PUT satisfies APIRoute;
export const DELETE = route.DELETE satisfies APIRoute;
