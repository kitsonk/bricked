import type { APIRoute } from "astro";
import * as route from "@/routes/api/orders/[orderId]/ship.ts";

export const PUT = route.PUT satisfies APIRoute;
