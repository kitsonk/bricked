import type { APIContext } from "astro";
import { getBuyerIndex } from "@/utils/kv.ts";

export async function GET({ url }: APIContext): Promise<Response> {
  const q = url.searchParams.get("q")?.trim() ?? "";
  const index = await getBuyerIndex();
  if (!q) {
    return Response.json(index);
  }
  const lower = q.toLowerCase();
  const matches = index.filter((name) => name.toLowerCase().includes(lower));
  return Response.json(matches);
}
