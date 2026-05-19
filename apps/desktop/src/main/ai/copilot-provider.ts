import type { AiCompletionRequest, AiCompletionResponse } from "@elevator/shared";
import type { AiProvider } from "./provider.js";

/**
 * Copilot provider stub. The plan keeps BYOM-ready configuration fields but
 * does not require Azure setup in the MVP, so this provider intentionally
 * surfaces a clear "not configured" error until credentials are wired in.
 */
export const copilotProvider: AiProvider = {
  name: "copilot",
  async complete(_req: AiCompletionRequest): Promise<AiCompletionResponse> {
    throw new Error(
      "Copilot provider is not configured. Set credentials in Settings to enable."
    );
  }
};
