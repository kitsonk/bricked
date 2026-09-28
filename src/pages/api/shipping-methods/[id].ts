import type { APIRoute } from "astro";
import * as route from "@/routes/api/shipping-methods/[id].ts";

export const PUT = route.PUT satisfies APIRoute;
