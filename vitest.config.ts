import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Keep unit tests off the production default database: `kv.sqlite3` in the working directory is the
// real store, and the banlist tests delete entries from whatever `KV_PATH` points at.
const testKvDir = fileURLToPath(new URL("./node_modules/.cache/", import.meta.url));
mkdirSync(testKvDir, { recursive: true });

export default defineConfig({
  resolve: { alias: { "@/": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    // The route suite predates Vitest and keeps its `smoke_test.ts` name (documented in AGENTS.md),
    // which the default `*.test.ts` glob would miss.
    include: ["**/*.test.ts", "**/*.test.tsx", "tests/**/*_test.ts"],
    // The unit tests mutate process.env per file — running files concurrently would cross-talk.
    fileParallelism: false,
    env: { KV_PATH: `${testKvDir}bricked-test-kv.sqlite3` },
  },
});
