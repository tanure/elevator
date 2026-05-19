import type { AiCompletionRequest, AiCompletionResponse } from "@elevator/shared";
import type { AiProvider } from "./provider.js";

/**
 * Deterministic offline provider used until a real Copilot/BYOM provider is
 * wired in. It echoes back a short structured response so the agent pipeline,
 * audit log, and UI can be exercised end-to-end without network calls.
 */
export const echoProvider: AiProvider = {
  name: "echo",
  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    const user = req.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");
    const system = req.messages.find((m) => m.role === "system")?.content ?? "";
    const text =
      `[echo provider]\n` +
      (system ? `system: ${system.split("\n")[0]?.slice(0, 120)}\n` : "") +
      `prompt: ${user.slice(0, 400)}`;
    return { text, provider: "echo", model: req.model ?? "echo-1" };
  }
};
