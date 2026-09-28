import type { APIRoute } from "astro";
import * as route from "@/routes/api/xml/index.ts";

export const POST = route.POST satisfies APIRoute;
