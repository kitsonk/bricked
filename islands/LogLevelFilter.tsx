import { useState } from "preact/hooks";
import type { LogLevel } from "@logtape/logtape";

const ALL_LEVELS: LogLevel[] = ["trace", "debug", "info", "warning", "error", "fatal"];

interface LogLevelFilterProps {
  appliedLevels: LogLevel[];
}

function levelCheckboxClass(level: LogLevel): string {
  switch (level) {
    case "trace":
      return "badge-neutral";
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

export default function LogLevelFilter({ appliedLevels }: LogLevelFilterProps) {
  const [pendingLevels, setPendingLevels] = useState<Set<LogLevel>>(new Set(appliedLevels));

  const toggleLevel = (level: LogLevel) => {
    const next = new Set(pendingLevels);
    if (next.has(level)) {
      next.delete(level);
    } else {
      next.add(level);
    }
    setPendingLevels(next);
  };

  const appliedSet = new Set(appliedLevels);
  const hasChanges = pendingLevels.size !== appliedSet.size ||
    !ALL_LEVELS.every((l) => pendingLevels.has(l) === appliedSet.has(l));

  return (
    <form method="GET" action="/admin/logs" class="mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-base-content/70 mr-1">Filter levels:</span>
        {ALL_LEVELS.map((level) => {
          const checked = pendingLevels.has(level);
          const wasApplied = appliedSet.has(level);
          const isPending = checked !== wasApplied;
          return (
            <label
              key={level}
              class={`badge badge-sm cursor-pointer transition-all ${levelCheckboxClass(level)} ${
                checked ? "opacity-100" : "opacity-40"
              } ${isPending ? "ring-2 ring-primary ring-offset-1" : ""}`}
            >
              <input
                type="checkbox"
                name="level"
                value={level}
                checked={checked}
                class="sr-only"
                onChange={() => toggleLevel(level)}
              />
              {level}
            </label>
          );
        })}
        <button
          type="submit"
          class={`btn btn-xs ml-2 ${hasChanges ? "btn-primary" : "btn-ghost"}`}
          disabled={!hasChanges}
        >
          <span class="iconify lucide--filter size-3"></span>
          Apply
        </button>
      </div>
    </form>
  );
}
