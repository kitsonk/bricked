import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
// Changelog entries are maintained in data/changelog.json — newest first.
// When new commits are merged, prepend a new entry to that file.
import CHANGES from "@/data/changelog.json" with { type: "json" };

type ChangeEntry = {
  hash: string;
  subject: string;
  body?: string;
};

export type ChangelogData = Record<string, never>;

export const handler = define.handlers<ChangelogData>({
  GET() {
    return page({});
  },
});

export function ChangelogContent(_: { data: ChangelogData }) {
  const changes = CHANGES as ChangeEntry[];
  return (
    <>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">Change Log</h1>
        <span class="text-sm text-base-content/50">{changes.length} entries</span>
      </div>

      <div class="flex flex-col gap-2">
        {changes.map((entry, i) => (
          <details key={entry.hash} class="collapse collapse-arrow bg-base-100 border border-base-300" open={i === 0}>
            <summary class="collapse-title font-semibold text-sm">
              {entry.subject}
            </summary>
            <div class="collapse-content text-sm text-base-content/70">
              {entry.body
                ? entry.body.split("\n\n").map((para, j) => <p key={j} class={j > 0 ? "mt-2" : ""}>{para}</p>)
                : <p class="italic text-base-content/40">No additional details.</p>}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

export default define.page<typeof handler>(function Changelog({ data }) {
  return (
    <AppFrame>
      <ChangelogContent data={data} />
    </AppFrame>
  );
});
