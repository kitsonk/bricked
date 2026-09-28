import type { APIRoute } from "astro";
import * as route from "@/routes/api/colors/refresh.ts";

export const POST = route.POST satisfies APIRoute;
