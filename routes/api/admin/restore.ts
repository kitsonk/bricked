import { importEntries } from "@deno/kv-utils/import-export";
import type { APIContext } from "astro";
import { kv } from "@/utils/kv.ts";

/** Refuse pathologically large uploads before buffering them into memory. */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Import a Deno KV NDJSON export — the output of `scripts/kv-export.ts` — into
 * the current store. Existing keys are left untouched unless `overwrite` is
 * `"true"`, matching `importEntries`' default. Per-record failures are counted
 * rather than thrown, so a partially valid file still imports what it can.
 */
export async function POST({ request }: APIContext): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected a multipart/form-data upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Missing NDJSON file upload" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "File exceeds the 100 MB upload limit" }, { status: 413 });
  }

  const overwrite = form.get("overwrite") === "true";
  const result = await importEntries(await kv(), file, { overwrite });
  return Response.json(result);
}
