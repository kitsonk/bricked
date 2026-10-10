import type { APIContext } from "astro";
import { kv } from "@/utils/kv.ts";
import { listLogRecords } from "@kitsonk/logtape-kv-sink";
import type { LogLevel, LogRecord } from "@logtape/logtape";
import type { PageResult } from "@/routes/pageResult.ts";

/**
 * `@kitsonk/logtape-kv-sink`'s generated declaration makes `AsyncLogRecordIterator` extend the bare
 * `AsyncIterator` interface, which carries no `[Symbol.asyncIterator]`. The class does implement it
 * at runtime, so restate the shape it actually has.
 */
type LogRecordIterator = AsyncIterable<LogRecord> & {
  next(): Promise<IteratorResult<LogRecord, undefined>>;
  readonly cursor: string;
};

const PAGE_SIZE = 20;
const ALL_LEVELS: LogLevel[] = ["trace", "debug", "info", "warning", "error", "fatal"];

export const LOG_LEVELS = ALL_LEVELS;

export type SerializedLogEntry = {
  timestamp: number;
  level: string;
  category: string[];
  message: string;
};

export type LogsData = {
  entries: SerializedLogEntry[];
  nextCursor: string | null;
  currentCursor: string | null;
  history: string[];
  levels: LogLevel[];
};

export async function loadLogs({ url }: APIContext): Promise<PageResult<LogsData>> {
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const history = url.searchParams.getAll("history");
  const selectedLevels = url.searchParams.getAll("level") as LogLevel[];
  const levels = selectedLevels.length > 0 ? selectedLevels : [...ALL_LEVELS];

  const iter = listLogRecords(kv(), {
    limit: PAGE_SIZE,
    cursor,
    level: levels.length === ALL_LEVELS.length ? [] : levels,
  }) as LogRecordIterator;
  const entries: SerializedLogEntry[] = [];
  for await (const record of iter) {
    entries.push({
      timestamp: record.timestamp,
      level: record.level,
      category: [...record.category],
      message: record.message.map(String).join(""),
    });
  }

  let nextCursor: string | null = null;
  if (entries.length === PAGE_SIZE) {
    nextCursor = iter.cursor;
  }

  return { kind: "data", data: { entries, nextCursor, currentCursor: cursor ?? null, history, levels } };
}

export function pageUrl(cursor: string | null, history: string[], levels: LogLevel[]): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  for (const h of history) params.append("history", h);
  for (const l of levels) params.append("level", l);
  const qs = params.toString();
  return qs ? `/admin/logs?${qs}` : "/admin/logs";
}

export function formatTimestamp(ts: number): string {
  return new Date(ts)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}

export function levelBadgeClass(level: string): string {
  switch (level) {
    case "debug":
      return "badge-ghost";
    case "info":
      return "badge-info";
    case "warning":
      return "badge-warning";
    case "error":
      return "badge-error";
    case "fatal":
      return "badge-error badge-outline font-bold";
    default:
      return "badge-neutral";
  }
}
