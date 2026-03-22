import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { getCredentials, saveCredentials } from "@/utils/kv.ts";

export const handler = define.handlers<{ configured: boolean }>({
  async GET(_ctx) {
    const creds = await getCredentials();
    return page({ configured: !!creds });
  },
  async POST(ctx) {
    const form = await ctx.req.formData();
    await saveCredentials({
      consumerKey: form.get("consumerKey")?.toString() ?? "",
      consumerSecret: form.get("consumerSecret")?.toString() ?? "",
      tokenValue: form.get("tokenValue")?.toString() ?? "",
      tokenSecret: form.get("tokenSecret")?.toString() ?? "",
    });
    return ctx.redirect("/settings?saved=1");
  },
});

export default define.page<typeof handler>(function Settings({ data, url }) {
  const saved = url.searchParams.has("saved");
  return (
    <AppFrame>
      <div class="p-6 max-w-lg">
        <h1 class="text-2xl font-bold mb-6">Settings</h1>

        {saved && (
          <div role="alert" class="alert alert-success mb-6">
            <span class="iconify lucide--circle-check size-5"></span>
            <span>Credentials saved successfully.</span>
          </div>
        )}

        {!data.configured && !saved && (
          <div role="alert" class="alert alert-warning mb-6">
            <span class="iconify lucide--alert-triangle size-5"></span>
            <span>BrickLink API credentials are not configured yet.</span>
          </div>
        )}

        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg">BrickLink API Credentials</h2>
            <p class="text-sm text-base-content/60 mb-2">
              Create an API key in your{" "}
              <a
                class="link"
                href="https://www.bricklink.com/v3/api.page"
                target="_blank"
                rel="noopener noreferrer"
              >
                BrickLink API settings
              </a>{" "}
              and enter the four credential values below.
            </p>
            <form method="POST" class="space-y-4 mt-2">
              <div>
                <label class="label text-sm font-medium mb-1 block" for="consumerKey">
                  Consumer Key
                </label>
                <input class="input w-full" id="consumerKey" name="consumerKey" type="text" required />
              </div>
              <div>
                <label class="label text-sm font-medium mb-1 block" for="consumerSecret">
                  Consumer Secret
                </label>
                <input class="input w-full" id="consumerSecret" name="consumerSecret" type="password" required />
              </div>
              <div>
                <label class="label text-sm font-medium mb-1 block" for="tokenValue">
                  Token
                </label>
                <input class="input w-full" id="tokenValue" name="tokenValue" type="text" required />
              </div>
              <div>
                <label class="label text-sm font-medium mb-1 block" for="tokenSecret">
                  Token Secret
                </label>
                <input class="input w-full" id="tokenSecret" name="tokenSecret" type="password" required />
              </div>
              <div class="pt-2">
                <button class="btn btn-primary" type="submit">Save Credentials</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppFrame>
  );
});
