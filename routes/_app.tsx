import { define } from "@/utils/fresh.ts";

export default define.page(function App({ Component }) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="noindex, nofollow" />
        <title>bricked</title>
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
});
