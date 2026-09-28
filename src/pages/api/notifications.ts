import type { APIRoute } from "astro";
import * as route from "@/routes/api/notifications.ts";

export const POST = route.POST satisfies APIRoute;
