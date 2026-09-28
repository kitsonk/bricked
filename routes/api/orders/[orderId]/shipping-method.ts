import type { APIContext } from "astro";
import { saveShippingOverride } from "@/utils/kv.ts";
import type { LocalShippingOverride } from "@/utils/types.ts";

export async function PUT({ request, params }: APIContext): Promise<Response> {
  const orderId = Number(params.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return Response.json({ error: "Invalid order id" }, { status: 400 });
  }

  const body = await request.json();
  const { methodId, methodName } = body;

  if (
    typeof methodId !== "number" ||
    !Number.isInteger(methodId) ||
    methodId <= 0 ||
    typeof methodName !== "string" ||
    methodName.trim() === ""
  ) {
    return Response.json({ error: "methodId (positive integer) and methodName (non-empty string) are required" }, {
      status: 400,
    });
  }

  const override: LocalShippingOverride = {
    methodId,
    methodName: methodName.trim(),
    updatedAt: new Date().toISOString(),
  };

  await saveShippingOverride(orderId, override);
  return Response.json(override);
}
