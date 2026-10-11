import type { APIRoute } from "astro";
import * as route from "@/routes/api/admin/restore.ts";

export const POST = route.POST satisfies APIRoute;
