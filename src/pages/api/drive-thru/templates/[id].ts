import type { APIRoute } from "astro";
import * as route from "@/routes/api/drive-thru/templates/[id].ts";

export const PUT = route.PUT satisfies APIRoute;
export const DELETE = route.DELETE satisfies APIRoute;
