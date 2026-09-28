import type { APIRoute } from "astro";
import * as route from "@/routes/api/drive-thru/[orderId].ts";

export const POST = route.POST satisfies APIRoute;
