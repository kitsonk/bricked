import { define } from "@/utils/fresh.ts";

export const handler = define.handlers({
  GET(ctx) {
    return ctx.redirect("/orders");
  },
});
