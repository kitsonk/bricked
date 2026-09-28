import type { APIRoute } from "astro";
import * as route from "@/routes/api/ship-list/verify-address.ts";

export const POST = route.POST satisfies APIRoute;
