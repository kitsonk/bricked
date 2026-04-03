import { define } from "@/utils/fresh.ts";
import { savePackageType } from "@/utils/kv.ts";
import type { PackageType } from "@/utils/types.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const body = await ctx.req.json();
    const { label, lengthCm, widthCm, heightCm } = body;
    if (!label || typeof lengthCm !== "number" || typeof widthCm !== "number" || typeof heightCm !== "number") {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const packageType: PackageType = {
      id: crypto.randomUUID(),
      label: String(label).trim(),
      lengthCm: Math.round(lengthCm * 10) / 10,
      widthCm: Math.round(widthCm * 10) / 10,
      heightCm: Math.round(heightCm * 10) / 10,
      createdAt: now,
      updatedAt: now,
    };
    await savePackageType(packageType);
    return Response.json(packageType, { status: 201 });
  },
});
