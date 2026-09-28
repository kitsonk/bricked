// Changelog entries are maintained in data/changelog.json — newest first.
// When new commits are merged, prepend a new entry to that file.
import CHANGES from "@/data/changelog.json" with { type: "json" };
import type { PageResult } from "@/routes/pageResult.ts";

type ChangeEntry = {
  hash: string;
  subject: string;
  body?: string;
};

export type ChangelogData = { changes: ChangeEntry[] };

export function loadChangelog(): PageResult<ChangelogData> {
  return { kind: "data", data: { changes: CHANGES as ChangeEntry[] } };
}
