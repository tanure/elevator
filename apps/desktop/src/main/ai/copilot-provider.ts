import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiMessage,
  AiStreamChunk
} from "@elevator/shared";
import {
  CopilotClient,
  approveAll,
  type CopilotSession
} from "@github/copilot-sdk";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import type { AiProvider } from "./provider.js";
import {
  DEFAULT_COPILOT_MODEL,
  getCopilotModel,
  getCopilotToken
} from "./copilot-token.js";

/**
 * Copilot provider backed by `@github/copilot-sdk`, which drives the GitHub
 * Copilot CLI (`@github/copilot`) over JSON-RPC. Auth resolution:
 *
 *   1. Token configured in Settings → AI (encrypted via Electron safeStorage)
 *      is passed to the SDK as `gitHubToken`.
 *   2. Otherwise the SDK uses the logged-in user from the Copilot CLI
 *      (`useLoggedInUser: true`, the SDK default).
 *
 * A single `CopilotClient` is started lazily and reused across calls; each
 * request opens a short-lived session and disconnects when it idles.
 *
 * NOTE: The SDK's default `getBundledCliPath()` incorrectly resolves to the
 * interactive CLI (`@github/copilot/index.js`) instead of the SDK server entry
 * (`@github/copilot/sdk/index.js`). We explicitly pass the correct `cliPath`.
 * Additionally, since `process.execPath` in Electron is `electron.exe`, we set
 * `ELECTRON_RUN_AS_NODE=1` so it behaves as a Node.js runtime.
 */

/**
 * Resolve the path to `@github/copilot/sdk/index.js` — the JSON-RPC server
 * entry point that the SDK needs (as opposed to the interactive CLI).
 */
function resolveCopilotSdkServer(): string {
  // Walk up from this compiled file to find the project's node_modules.
  // In dev: __dirname is apps/desktop/src/main/ai (or dist equivalent)
  // The monorepo root node_modules contains @github/copilot.
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "node_modules", "@github", "copilot", "sdk", "index.js");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Absolute fallback (should not be reached in normal installs)
  return join(__dirname, "..", "..", "..", "node_modules", "@github", "copilot", "sdk", "index.js");
}

let clientPromise: Promise<CopilotClient> | null = null;
let clientAuthKey: string | null = null;

/**
 * Returns a started `CopilotClient` keyed by the current token fingerprint.
 * Exposed so other modules (IPC handlers) can query `listModels()` /
 * `getAuthStatus()` against the same shared connection.
 */
export async function getCopilotClient(): Promise<CopilotClient> {
  return getClient();
}

async function getClient(): Promise<CopilotClient> {
  const token = await getCopilotToken();
  const authKey = token ? `tok:${token.length}:${token.slice(0, 6)}` : "user";
  if (clientPromise && clientAuthKey === authKey) {
    return clientPromise;
  }
  if (clientPromise) {
    const prev = clientPromise;
    clientPromise = null;
    prev.then((c) => c.stop().catch(() => {})).catch(() => {});
  }
  clientAuthKey = authKey;
  clientPromise = (async () => {
    const c = new CopilotClient({
      ...(token ? { gitHubToken: token } : { useLoggedInUser: true }),
      // Explicit cliPath: the SDK's default resolution incorrectly picks the
      // interactive CLI. We point to the SDK server entry instead.
      cliPath: resolveCopilotSdkServer(),
      // ELECTRON_RUN_AS_NODE makes electron.exe behave as pure Node.js when
      // the SDK spawns the CLI subprocess via process.execPath.
      // NODE_NO_WARNINGS suppresses the experimental SQLite warning that the
      // SDK misinterprets as a fatal stderr error.
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_NO_WARNINGS: "1"
      }
    });
    await c.start();
    return c;
  })();
  return clientPromise;
}

async function resolveModel(reqModel?: string): Promise<string> {
  const explicit = reqModel?.trim();
  if (explicit) return explicit;
  const stored = (await getCopilotModel()).trim();
  // Legacy values like "openai/gpt-4o-mini" are not valid for the SDK.
  if (!stored || stored.includes("/")) return DEFAULT_COPILOT_MODEL;
  return stored;
}

/**
 * Collapse the AiCompletionRequest messages into a single SDK call.
 * Elevator's AiProvider contract is stateless per call; the SDK session API
 * is stateful. Prior turns are inlined into the prompt as a transcript.
 */
function buildPrompt(messages: AiMessage[]): {
  systemPrompt: string | null;
  prompt: string;
} {
  const systems: string[] = [];
  const turns: AiMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") systems.push(m.content);
    else turns.push(m);
  }
  const systemPrompt = systems.length ? systems.join("\n\n") : null;
  if (turns.length === 0) return { systemPrompt, prompt: "" };
  const last = turns[turns.length - 1];
  const history = turns.slice(0, -1);
  if (history.length === 0) return { systemPrompt, prompt: last.content };
  const lines = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  return {
    systemPrompt,
    prompt: `Conversation so far:\n${lines}\n\nUser: ${last.content}`
  };
}

async function openSession(
  client: CopilotClient,
  model: string,
  systemPrompt: string | null,
  streaming: boolean
): Promise<CopilotSession> {
  return client.createSession({
    model,
    streaming,
    onPermissionRequest: approveAll,
    ...(systemPrompt ? { systemMessage: { content: systemPrompt } } : {})
  });
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function wrap(err: unknown): Error {
  const detail = describe(err);
  const lower = detail.toLowerCase();
  if (
    lower.includes("unauthenticated") ||
    lower.includes("not authenticated") ||
    lower.includes("authentication required") ||
    lower.includes("401")
  ) {
    return new Error(
      "Copilot is not authenticated. Add a token in Settings → AI, or run " +
        "`gh auth login` and ensure your account has an active Copilot " +
        `subscription. (${detail})`
    );
  }
  return new Error(`Copilot request failed: ${detail}`);
}

export const copilotProvider: AiProvider = {
  name: "copilot",
  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    const client = await getClient();
    const model = await resolveModel(req.model);
    const { systemPrompt, prompt } = buildPrompt(req.messages);
    let session: CopilotSession | null = null;
    try {
      session = await openSession(client, model, systemPrompt, false);
      const result = await session.sendAndWait({ prompt });
      const text = result?.data?.content ?? "";
      return { text, provider: "copilot", model };
    } catch (err) {
      throw wrap(err);
    } finally {
      if (session) await session.disconnect().catch(() => {});
    }
  },
  async *stream(req: AiCompletionRequest): AsyncIterable<AiStreamChunk> {
    const client = await getClient();
    const model = await resolveModel(req.model);
    const { systemPrompt, prompt } = buildPrompt(req.messages);
    let session: CopilotSession | null = null;
    try {
      session = await openSession(client, model, systemPrompt, true);

      const queue: AiStreamChunk[] = [];
      let waiter: (() => void) | null = null;
      let done = false;
      let failure: unknown = null;

      const wake = (): void => {
        const w = waiter;
        waiter = null;
        w?.();
      };

      const offDelta = session.on("assistant.message_delta", (event) => {
        const delta = event.data.deltaContent;
        if (delta) {
          queue.push({ delta });
          wake();
        }
      });
      const offIdle = session.on("session.idle", () => {
        done = true;
        wake();
      });

      session.send({ prompt }).catch((err) => {
        failure = err;
        done = true;
        wake();
      });

      try {
        while (true) {
          if (failure) throw failure;
          if (queue.length > 0) {
            yield queue.shift()!;
            continue;
          }
          if (done) return;
          await new Promise<void>((resolve) => {
            waiter = resolve;
          });
        }
      } finally {
        offDelta();
        offIdle();
      }
    } catch (err) {
      throw wrap(err);
    } finally {
      if (session) await session.disconnect().catch(() => {});
    }
  }
};

/** Stop the cached client. Wire into `app.on("will-quit")`. */
export async function shutdownCopilotProvider(): Promise<void> {
  const p = clientPromise;
  clientPromise = null;
  clientAuthKey = null;
  if (!p) return;
  try {
    const c = await p;
    await c.stop();
  } catch {
    /* ignore */
  }
}
