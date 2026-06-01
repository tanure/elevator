import {
  appendAuditLog,
  appendChatMessage,
  getAgent,
  getChatSession,
  listChatMessages,
  touchChatSession,
  updateChatSession
} from "@elevator/data";
import type {
  AgentRecord,
  AgentTool,
  AgentToolCall,
  AiMessage,
  AiProviderName,
  ChatMessage,
  ChatSendResult,
  ChatSession,
  ChatStreamEvent
} from "@elevator/shared";
import { BrowserWindow } from "electron";
import { getDb } from "../db.js";
import { getProvider } from "./registry.js";
import { dispatchAgentTool, listAgentTools } from "./tools.js";

const TITLE_MAX = 60;

/**
 * Merge an agent's defaults into a chat session. Session-level overrides win
 * for provider/model/maxToolCalls; allowedTools falls back to the agent when
 * the session has none; systemPrompt is composed as
 * `<agent.systemPrompt>\n\nGoal: <agent.goal>\n\n<session.systemPrompt>`
 * so the agent's persona is always present even if the user has customised
 * the session prompt.
 */
function mergeAgentIntoSession(
  session: ChatSession,
  agent: AgentRecord | null
): ChatSession {
  if (!agent) return session;
  const parts: string[] = [];
  if (agent.systemPrompt.trim()) parts.push(agent.systemPrompt.trim());
  if (agent.goal.trim()) parts.push(`Goal: ${agent.goal.trim()}`);
  if (session.systemPrompt.trim()) parts.push(session.systemPrompt.trim());
  const effectiveSystemPrompt = parts.join("\n\n");
  const effectiveAllowedTools =
    session.allowedTools.length > 0 ? session.allowedTools : agent.allowedTools;
  return {
    ...session,
    systemPrompt: effectiveSystemPrompt,
    allowedTools: effectiveAllowedTools
  };
}

/**
 * Run one chat turn:
 *  1. Persist the user message.
 *  2. Call the provider with conversation history + allowed tools.
 *  3. If the provider asks for tool calls, dispatch them, append the results
 *     to the conversation, and call again (bounded by maxToolCalls).
 *  4. Persist the final assistant message (with toolCalls metadata if any).
 */
export async function sendChatMessage(
  sessionId: string,
  content: string,
  contextPayload?: unknown
): Promise<ChatSendResult> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Chat message is empty");
  }

  const db = getDb();
  const rawSession = await getChatSession(db, sessionId);
  if (!rawSession) {
    throw new Error(`Unknown chat session: ${sessionId}`);
  }
  const agent = rawSession.agentId ? await getAgent(db, rawSession.agentId) : null;
  let session = mergeAgentIntoSession(rawSession, agent);

  // Phase 5 (M11): renderer may attach a contextPayload describing the current
  // view, selected card, date, etc. We prepend it to the system prompt as a
  // structured block so the model can reference it without polluting the
  // user-visible conversation.
  const contextBlock = formatContextPayload(contextPayload);
  if (contextBlock) {
    session = {
      ...session,
      systemPrompt: session.systemPrompt
        ? `${contextBlock}\n\n${session.systemPrompt}`
        : contextBlock
    };
  }

  const userMessage = await appendChatMessage(db, {
    sessionId,
    role: "user",
    content: trimmed
  });

  // Auto-title the session from the first user message.
  if (session.title === "New chat") {
    const next = trimmed.length > TITLE_MAX ? trimmed.slice(0, TITLE_MAX) + "…" : trimmed;
    await updateChatSession(db, sessionId, { title: next });
  } else {
    await touchChatSession(db, sessionId);
  }

  const history = await listChatMessages(db, sessionId);
  const messages = buildPromptMessages(session.systemPrompt, history);

  await appendAuditLog(db, "chat", "chat.send", sessionId, {
    provider: session.provider,
    model: session.model ?? null,
    messageCount: history.length
  });

  let assistantMessage: ChatMessage;
  try {
    const result = await runChatTurn(session, messages);
    assistantMessage = await appendChatMessage(db, {
      sessionId,
      role: "assistant",
      content: result.text,
      provider: result.provider,
      model: result.model,
      toolCalls: result.toolCalls
    });
    await touchChatSession(db, sessionId);
    await appendAuditLog(db, "chat", "chat.reply", sessionId, {
      provider: result.provider,
      model: result.model,
      toolCallCount: result.toolCalls.length
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    assistantMessage = await appendChatMessage(db, {
      sessionId,
      role: "assistant",
      content: `**Error from provider \`${session.provider}\`:** ${message}`,
      provider: session.provider as AiProviderName,
      model: session.model ?? null
    });
    await touchChatSession(db, sessionId);
    await appendAuditLog(db, "chat", "chat.error", sessionId, {
      provider: session.provider,
      error: message
    });
  }

  return { userMessage, assistantMessage };
}

interface ChatTurnResult {
  text: string;
  provider: AiProviderName;
  model: string;
  toolCalls: AgentToolCall[];
}

async function runChatTurn(
  session: ChatSession,
  initialMessages: AiMessage[]
): Promise<ChatTurnResult> {
  const provider = getProvider(session.provider);
  const tools = session.allowedTools.length
    ? await resolveAllowedTools(session.allowedTools)
    : [];
  const messages = [...initialMessages];
  const toolCalls: AgentToolCall[] = [];

  let iterations = 0;
  while (true) {
    const canStream =
      typeof provider.stream === "function" && tools.length === 0;
    let response: {
      text: string;
      provider: AiProviderName;
      model: string;
      toolCalls?: { toolId: string; input: Record<string, unknown> }[];
    };
    if (canStream) {
      response = await streamComplete(provider, session, {
        messages,
        tools: undefined,
        model: session.model ?? undefined
      });
    } else {
      response = await provider.complete({
        messages,
        tools: tools.length ? tools : undefined,
        model: session.model ?? undefined
      });
    }

    if (!response.toolCalls || response.toolCalls.length === 0) {
      return {
        text: response.text,
        provider: response.provider,
        model: response.model,
        toolCalls
      };
    }

    if (iterations >= session.maxToolCalls) {
      throw new Error(
        `Tool-call limit reached (${session.maxToolCalls}). Aborting to prevent runaway loops.`
      );
    }

    for (const call of response.toolCalls) {
      const allowed = session.allowedTools.includes(call.toolId);
      const startedAt = new Date().toISOString();
      if (!allowed) {
        const record: AgentToolCall = {
          toolId: call.toolId,
          input: call.input,
          output: null,
          ok: false,
          error: "Tool not permitted by chat session",
          startedAt,
          completedAt: new Date().toISOString()
        };
        toolCalls.push(record);
        messages.push({
          role: "assistant",
          content: `Tool call rejected: ${call.toolId} is not in the allowed list.`
        });
        continue;
      }
      const result = await dispatchAgentTool(call.toolId, call.input);
      const record: AgentToolCall = {
        toolId: call.toolId,
        input: call.input,
        output: result.output ?? null,
        ok: result.ok,
        error: result.error ?? null,
        startedAt,
        completedAt: new Date().toISOString()
      };
      toolCalls.push(record);
      messages.push({
        role: "assistant",
        content:
          `Tool result for ${call.toolId} (` +
          (result.ok ? "ok" : "error") +
          `):\n` +
          (result.ok ? safeStringify(result.output) : (result.error ?? "unknown error"))
      });
    }

    iterations += 1;
  }
}

/**
 * Call `provider.stream`, broadcasting each chunk to renderers via
 * `chat:stream` and returning the assembled completion. Falls back to
 * `provider.complete` if the provider does not implement `stream`.
 */
async function streamComplete(
  provider: ReturnType<typeof getProvider>,
  session: ChatSession,
  req: {
    messages: AiMessage[];
    tools?: AgentTool[];
    model?: string;
  }
): Promise<{
  text: string;
  provider: AiProviderName;
  model: string;
}> {
  if (!provider.stream) {
    const resp = await provider.complete(req);
    return { text: resp.text, provider: resp.provider, model: resp.model };
  }
  let text = "";
  try {
    for await (const chunk of provider.stream(req)) {
      if (!chunk.delta) continue;
      text += chunk.delta;
      broadcastStream({
        sessionId: session.id,
        text,
        delta: chunk.delta,
        kind: "chunk"
      });
    }
  } catch (err) {
    broadcastStream({
      sessionId: session.id,
      text,
      delta: "",
      kind: "error",
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
  broadcastStream({
    sessionId: session.id,
    text,
    delta: "",
    kind: "end"
  });
  return {
    text,
    provider: session.provider as AiProviderName,
    model: session.model ?? "stream"
  };
}

function broadcastStream(event: ChatStreamEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send("chat:stream", event);
  }
}

async function resolveAllowedTools(allowed: string[]): Promise<AgentTool[]> {
  const all = await listAgentTools();
  const allowSet = new Set(allowed);
  return all.filter((t) => allowSet.has(t.id));
}

/**
 * Render a renderer-supplied context payload as a system-prompt block. Returns
 * null when the payload is missing or empty (so we don't pollute the prompt
 * with an empty `Context:` header).
 */
function formatContextPayload(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === "object" && Object.keys(payload as object).length === 0) {
    return null;
  }
  let serialised: string;
  try {
    serialised = JSON.stringify(payload, null, 2);
  } catch {
    return null;
  }
  return [
    "UI context (provided by the application; for your reference only):",
    "```json",
    serialised,
    "```"
  ].join("\n");
}

function buildPromptMessages(
  systemPrompt: string,
  history: ChatMessage[]
): AiMessage[] {
  const messages: AiMessage[] = [];
  if (systemPrompt.trim()) {
    messages.push({ role: "system", content: systemPrompt });
  }
  for (const m of history) {
    if (m.role === "system" && messages.some((x) => x.role === "system")) continue;
    messages.push({ role: m.role, content: m.content });
  }
  return messages;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
