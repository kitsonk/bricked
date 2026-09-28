import type { APIRoute } from "astro";
import * as route from "@/routes/api/xml/import.ts";

export const POST = route.POST satisfies APIRoute;
