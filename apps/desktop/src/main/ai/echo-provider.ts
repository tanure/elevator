import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiStreamChunk
} from "@elevator/shared";
import type { AiProvider } from "./provider.js";

function buildEchoText(req: AiCompletionRequest): string {
  const user = req.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const system = req.messages.find((m) => m.role === "system")?.content ?? "";
  return (
    `[echo provider]\n` +
    (system ? `system: ${system.split("\n")[0]?.slice(0, 120)}\n` : "") +
    `prompt: ${user.slice(0, 400)}`
  );
}

/**
 * Deterministic offline provider used until a real Copilot/BYOM provider is
 * wired in. It echoes back a short structured response so the agent pipeline,
 * audit log, and UI can be exercised end-to-end without network calls.
 */
export const echoProvider: AiProvider = {
  name: "echo",
  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    const text = buildEchoText(req);
    return { text, provider: "echo", model: req.model ?? "echo-1" };
  },
  async *stream(req: AiCompletionRequest): AsyncIterable<AiStreamChunk> {
    const text = buildEchoText(req);
    // Chunk by ~12-char windows to simulate token-level streaming without
    // requiring a tokenizer. Yield with a tiny delay so the renderer can
    // paint each delta separately.
    const size = 12;
    for (let i = 0; i < text.length; i += size) {
      const delta = text.slice(i, i + size);
      yield { delta };
      await new Promise((r) => setTimeout(r, 20));
    }
  }
};
