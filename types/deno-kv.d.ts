// `@deno/kv-utils` types its public API against the Deno global namespace
// (`Deno.Kv`, `Deno.KvKey`, …), but the npm bridge `@deno/kv` exposes the same
// runtime types without declaring the namespace. Restate only the members that
// kv-utils' declarations reference, sourced from `@deno/kv` so the two stay in
// lockstep.
declare namespace Deno {
  type Kv = import("@deno/kv").Kv;
  type KvCommitResult = import("@deno/kv").KvCommitResult;
  type KvEntry<T = unknown> = import("@deno/kv").KvEntry<T>;
  type KvEntryMaybe<T = unknown> = import("@deno/kv").KvEntryMaybe<T>;
  type KvKey = import("@deno/kv").KvKey;
  type KvKeyPart = import("@deno/kv").KvKeyPart;
  type KvListOptions = import("@deno/kv").KvListOptions;
  type KvListSelector = import("@deno/kv").KvListSelector;
  type KvU64 = import("@deno/kv").KvU64;
}
