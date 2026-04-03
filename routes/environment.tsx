import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";

export default define.page(function Settings() {
  return (
    <AppFrame>
      <div class="max-w-lg">
        <h1 class="text-2xl font-bold mb-6">Environment</h1>

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

        <div class="card bg-base-200 mt-6">
          <div class="card-body">
            <h2 class="card-title text-lg">AddressFinder Credentials</h2>
            <p class="text-sm text-base-content/60 mb-4">
              Used to verify and normalise Australian shipping addresses. Set the following in your <code>.env</code>
              {" "}
              file (local) or application configuration (Deno Deploy):
            </p>
            <ul class="text-sm font-mono space-y-1">
              <li>
                <span
                  class={`badge badge-sm mr-2 ${Deno.env.get("ADDRESSFINDER_KEY") ? "badge-success" : "badge-warning"}`}
                >
                  {Deno.env.get("ADDRESSFINDER_KEY") ? "set" : "missing"}
                </span>
                ADDRESSFINDER_KEY
              </li>
              <li>
                <span
                  class={`badge badge-sm mr-2 ${
                    Deno.env.get("ADDRESSFINDER_SECRET") ? "badge-success" : "badge-warning"
                  }`}
                >
                  {Deno.env.get("ADDRESSFINDER_SECRET") ? "set" : "missing"}
                </span>
                ADDRESSFINDER_SECRET
              </li>
            </ul>
          </div>
        </div>
      </div>
    </AppFrame>
  );
});
