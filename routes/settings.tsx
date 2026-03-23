import { page } from "fresh";
import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";
import { getCredentials } from "@/utils/kv.ts";

export const handler = define.handlers<{ configured: boolean }>({
  GET(_ctx) {
    const creds = getCredentials();
    return page({ configured: !!creds });
  },
});

export default define.page<typeof handler>(function Settings({ data }) {
  return (
    <AppFrame>
      <div class="p-6 max-w-lg">
        <h1 class="text-2xl font-bold mb-6">Settings</h1>

        {data.configured
          ? (
            <div role="alert" class="alert alert-success mb-6">
              <span class="iconify lucide--circle-check size-5"></span>
              <span>BrickLink API credentials are configured.</span>
            </div>
          )
          : (
            <div role="alert" class="alert alert-warning mb-6">
              <span class="iconify lucide--alert-triangle size-5"></span>
              <span>BrickLink API credentials are not configured.</span>
            </div>
          )}

        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg">BrickLink API Credentials</h2>
            <p class="text-sm text-base-content/60 mb-4">
              Credentials are configured via environment variables. Set the following in your <code>.env</code>{" "}
              file (local) or application configuration (Deno Deploy):
            </p>
            <ul class="text-sm font-mono space-y-1">
              <li>
                <span
                  class={`badge badge-sm mr-2 ${
                    Deno.env.get("BRICKLINK_CONSUMER_KEY") ? "badge-success" : "badge-warning"
                  }`}
                >
                  {Deno.env.get("BRICKLINK_CONSUMER_KEY") ? "set" : "missing"}
                </span>
                BRICKLINK_CONSUMER_KEY
              </li>
              <li>
                <span
                  class={`badge badge-sm mr-2 ${
                    Deno.env.get("BRICKLINK_CONSUMER_SECRET") ? "badge-success" : "badge-warning"
                  }`}
                >
                  {Deno.env.get("BRICKLINK_CONSUMER_SECRET") ? "set" : "missing"}
                </span>
                BRICKLINK_CONSUMER_SECRET
              </li>
              <li>
                <span
                  class={`badge badge-sm mr-2 ${Deno.env.get("BRICKLINK_TOKEN") ? "badge-success" : "badge-warning"}`}
                >
                  {Deno.env.get("BRICKLINK_TOKEN") ? "set" : "missing"}
                </span>
                BRICKLINK_TOKEN
              </li>
              <li>
                <span
                  class={`badge badge-sm mr-2 ${
                    Deno.env.get("BRICKLINK_TOKEN_SECRET") ? "badge-success" : "badge-warning"
                  }`}
                >
                  {Deno.env.get("BRICKLINK_TOKEN_SECRET") ? "set" : "missing"}
                </span>
                BRICKLINK_TOKEN_SECRET
              </li>
            </ul>
            <p class="text-sm text-base-content/60 mt-4">
              Create an API key in your{" "}
              <a
                class="link"
                href="https://www.bricklink.com/v3/api.page"
                target="_blank"
                rel="noopener noreferrer"
              >
                BrickLink API settings
              </a>.
            </p>
          </div>
        </div>
      </div>
    </AppFrame>
  );
});
