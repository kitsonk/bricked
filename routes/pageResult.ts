export type PageResult<T> =
  | { kind: "redirect"; to: string }
  | { kind: "notFound" }
  | { kind: "response"; response: Response }
  | { kind: "data"; data: T };
