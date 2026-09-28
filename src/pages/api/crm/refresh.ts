import type { APIRoute } from "astro";
import * as route from "@/routes/api/crm/refresh.ts";

export const POST = route.POST satisfies APIRoute;
