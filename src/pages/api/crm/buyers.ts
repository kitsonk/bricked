import type { APIRoute } from "astro";
import * as route from "@/routes/api/crm/buyers.ts";

export const GET = route.GET satisfies APIRoute;
