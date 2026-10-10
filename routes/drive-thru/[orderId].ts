import type { APIContext } from "astro";
import { BricklinkClient } from "@/utils/bricklink.ts";
import {
  getCredentials,
  getCustomer,
  getDefaultTemplateId,
  getDriveThruSent,
  listDriveThruTemplates,
  listTemplateRules,
} from "@/utils/kv.ts";
import type { BLOrder, DriveThruSentRecord, DriveThruTemplate } from "@/utils/types.ts";
import { patchOrderShipping } from "@/utils/orders.ts";
import { evaluateTemplateRules } from "@/utils/drive-thru.ts";
import type { PageResult } from "@/routes/pageResult.ts";

export type DriveThruData = {
  order: BLOrder | null;
  templates: DriveThruTemplate[];
  sentRecord: DriveThruSentRecord | null;
  selectedTemplateId: string | null;
  matchedRuleName: string | null;
  error: string | null;
};

export async function loadDriveThru({ params }: APIContext): Promise<PageResult<DriveThruData>> {
  const creds = getCredentials();
  if (!creds) {
    return { kind: "redirect", to: "/environment" };
  }

  const orderId = Number(params.orderId);
  if (Number.isNaN(orderId)) {
    return {
      kind: "data",
      data: {
        order: null,
        templates: [],
        sentRecord: null,
        selectedTemplateId: null,
        matchedRuleName: null,
        error: "Invalid order ID",
      },
    };
  }

  try {
    const client = new BricklinkClient(creds);
    const [order, templates, sentRecord, rules, defaultTemplateId] = await Promise.all([
      client.getOrder(orderId),
      listDriveThruTemplates(),
      getDriveThruSent(orderId),
      listTemplateRules(),
      getDefaultTemplateId(),
    ]);
    if (order) await patchOrderShipping(order);
    const customer = order ? await getCustomer(order.buyer_name) : null;
    const { templateId, matchedRule } = evaluateTemplateRules(rules, order, customer, defaultTemplateId);
    return {
      kind: "data",
      data: {
        order,
        templates,
        sentRecord,
        selectedTemplateId: templateId,
        matchedRuleName: matchedRule?.name ?? null,
        error: null,
      },
    };
  } catch (err) {
    return {
      kind: "data",
      data: {
        order: null,
        templates: [],
        sentRecord: null,
        selectedTemplateId: null,
        matchedRuleName: null,
        error: String(err),
      },
    };
  }
}
