/**
 * Export every entry from a Deno KV store to newline-delimited JSON (NDJSON).
 *
 * The records use the Deno KV JSON encoding emitted by `@deno/kv-utils`'s
 * `exportEntries` — key parts and values are wrapped as `{ type, value }` so
 * types Deno KV supports but JSON does not (bigint, Uint8Array, Date, KvU64, …)
 * survive the round trip. The resulting file is what bricked's
 * Admin → Restore Backup page imports with `importEntries`.
 *
 * Run it against the retired Deno production store (a real Deno runtime reads
 * that database natively, sidestepping the `@deno/kv` bridge's deserialiser)
 * and upload the output to the Node app:
 *
 *   deno run -A --unstable-kv scripts/kv-export.ts <target> [output.ndjson]
 *
 * (`--unstable-kv` is required because `Deno.openKv` is still an unstable API.)
 *
 * `target` is anything `Deno.openKv` accepts: a local SQLite path such as
 * `./kv.sqlite3`, or a remote KV URL (`https://…`, requiring
 * `DENO_KV_ACCESS_TOKEN`). With no output path the NDJSON is written to stdout.
 */

import { exportEntries } from "jsr:@deno/kv-utils@0.1.4/import-export";

const [target, output] = Deno.args;

if (!target) {
  console.error("usage: deno run -A --unstable-kv scripts/kv-export.ts <kv-path-or-url> [output.ndjson]");
  Deno.exit(2);
}

const db = await Deno.openKv(target);
const file = output ? await Deno.open(output, { create: true, write: true, truncate: true }) : Deno.stdout;

let entries = 0;
let bytes = 0;
try {
  // An empty prefix selects the whole store.
  for await (const chunk of exportEntries(db, { prefix: [] })) {
    await file.write(chunk);
    bytes += chunk.byteLength;
    for (const byte of chunk) {
      if (byte === 0x0a) entries++;
    }
  }
} finally {
  db.close();
  if (file !== Deno.stdout) file.close();
}

console.error(`exported ${entries} entries (${bytes} bytes)${output ? ` to ${output}` : ""}`);
