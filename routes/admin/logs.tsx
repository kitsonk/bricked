import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { kv } from "@/utils/kv.ts";
import { listLogRecords } from "@kitsonk/logtape-kv-sink";

const PAGE_SIZE = 20;

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
};

export const handler = define.handlers<LogsData>({
  async GET(ctx) {
    const cursor = ctx.url.searchParams.get("cursor") ?? undefined;
    const history = ctx.url.searchParams.getAll("history");

    const iter = listLogRecords(kv(), { limit: PAGE_SIZE, cursor });
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

    return page({ entries, nextCursor, currentCursor: cursor ?? null, history });
  },
});

function pageUrl(cursor: string | null, history: string[]): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  for (const h of history) params.append("history", h);
  const qs = params.toString();
  return qs ? `/admin/logs?${qs}` : "/admin/logs";
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function levelBadgeClass(level: string): string {
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

export function LogsContent({ data }: { data: LogsData }) {
  const { entries, nextCursor, currentCursor, history } = data;

  const hasPrev = history.length > 0;
  const prevCursor = hasPrev ? (history[history.length - 1] || null) : null;
  const prevHistory = history.slice(0, -1);
  const olderUrl = nextCursor ? pageUrl(nextCursor, [...history, currentCursor ?? ""]) : null;
  const newerUrl = hasPrev ? pageUrl(prevCursor, prevHistory) : null;
  const isFirstPage = !hasPrev && !currentCursor;

  return (
    <>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">Logs</h1>
        <a href="/admin/logs" class="btn btn-ghost btn-sm">
          <span class="iconify lucide--refresh-cw size-4"></span>
          Latest
        </a>
      </div>

      <div class="border border-base-content/10 rounded-box">
        {entries.length === 0
          ? (
            <div class="p-8 text-center text-base-content/50">
              <span class="iconify lucide--scroll size-8 mb-2 block mx-auto"></span>
              No log entries found.
            </div>
          )
          : (
            <div class="overflow-x-auto">
              <table class="table table-sm table-zebra">
                <thead>
                  <tr>
                    <th class="whitespace-nowrap">Timestamp</th>
                    <th>Level</th>
                    <th>Category</th>
                    <th class="w-full">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => (
                    <tr key={i}>
                      <td class="whitespace-nowrap font-mono text-xs text-base-content/70">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td>
                        <span class={`badge badge-sm ${levelBadgeClass(entry.level)}`}>
                          {entry.level}
                        </span>
                      </td>
                      <td class="font-mono text-xs text-base-content/70 whitespace-nowrap">
                        {entry.category.join(".")}
                      </td>
                      <td class="font-mono text-xs whitespace-pre-wrap break-all">
                        {entry.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        <div class="flex items-center justify-between px-4 py-3 border-t border-base-content/10">
          <div class="text-sm text-base-content/50">
            {isFirstPage ? "Showing latest entries" : "Showing older entries"}
          </div>
          <div class="flex gap-2">
            {newerUrl
              ? (
                <a href={newerUrl} class="btn btn-ghost btn-sm">
                  <span class="iconify lucide--arrow-left size-4"></span>
                  Newer
                </a>
              )
              : (
                <button type="button" class="btn btn-ghost btn-sm" disabled>
                  <span class="iconify lucide--arrow-left size-4"></span>
                  Newer
                </button>
              )}
            {olderUrl
              ? (
                <a href={olderUrl} class="btn btn-ghost btn-sm">
                  Older
                  <span class="iconify lucide--arrow-right size-4"></span>
                </a>
              )
              : (
                <button type="button" class="btn btn-ghost btn-sm" disabled>
                  Older
                  <span class="iconify lucide--arrow-right size-4"></span>
                </button>
              )}
          </div>
        </div>
      </div>
    </>
  );
}

export default define.page<typeof handler>(function Logs({ data }) {
  return (
    <AppFrame>
      <LogsContent data={data} />
    </AppFrame>
  );
});
