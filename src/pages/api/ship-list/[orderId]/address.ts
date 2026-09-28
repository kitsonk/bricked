import type { APIRoute } from "astro";
import * as route from "@/routes/api/ship-list/[orderId]/address.ts";

export const PUT = route.PUT satisfies APIRoute;
