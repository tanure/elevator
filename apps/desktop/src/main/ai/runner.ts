import { randomUUID } from "node:crypto";
import {
  appendAuditLog,
  completeAgentRun,
  createAgentRun,
  failAgentRun,
  getAgent,
  getSkill
} from "@elevator/data";
import type {
  AgentRecord,
  AgentRun,
  AgentTool,
  AgentToolCall,
  AiMessage,
  AiProviderName,
  SkillRecord
} from "@elevator/shared";
import { getDb } from "../db.js";
import { eventBus } from "../event-bus.js";
import { getProvider } from "./registry.js";
import {
  getSkillContextProvider,
  renderPromptTemplate
} from "./skills.js";
import { dispatchAgentTool, listAgentTools } from "./tools.js";

interface RunSkillOptions {
  /** Optional agent that owns this run. When provided the agent controls
   *  provider, model, and tool-call limits. */
  agentId?: string;
  /** Override provider for this single run. Ignored when `agentId` is set. */
  provider?: AiProviderName;
  /** Cap on tool-call iterations. Defaults to 5 (or the agent's setting). */
  maxToolCalls?: number;
}

export async function runSkill(
  skillId: string,
  input: Record<string, unknown> = {},
  options: RunSkillOptions = {}
): Promise<AgentRun> {
  const db = getDb();
  const skill = await getSkill(db, skillId);
  if (!skill) {
    throw new Error(`Unknown skill: ${skillId}`);
  }

  const agent = options.agentId ? await getAgent(db, options.agentId) : null;
  if (options.agentId && !agent) {
    throw new Error(`Unknown agent: ${options.agentId}`);
  }

  const providerName: AiProviderName = agent?.provider ?? options.provider ?? "echo";
  const maxToolCalls = clampMax(
    options.maxToolCalls ?? agent?.maxToolCalls ?? 5
  );

  const runId = randomUUID();
  const run = await createAgentRun(db, {
    id: runId,
    skillId,
    agentId: agent?.id ?? null,
    input
  });
  await appendAuditLog(db, "agent", "agent.start", runId, {
    skillId,
    agentId: agent?.id ?? null,
    provider: providerName
  });

  const toolCalls: AgentToolCall[] = [];
  try {
    const result = await executeRun({
      skill,
      agent,
      providerName,
      input,
      maxToolCalls,
      toolCalls
    });
    await completeAgentRun(db, runId, { output: result.text, toolCalls });
    await appendAuditLog(db, "agent", "agent.complete", runId, {
      skillId,
      agentId: agent?.id ?? null,
      provider: result.provider,
      model: result.model,
      toolCallCount: toolCalls.length
    });
    eventBus.emit("agent.completed", { id: runId });
    return {
      id: runId,
      skillId,
      agentId: agent?.id ?? null,
      status: "succeeded",
      input,
      output: result.text,
      error: null,
      toolCalls,
      startedAt: run.startedAt,
      completedAt: new Date()
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failAgentRun(db, runId, message, { toolCalls });
    await appendAuditLog(db, "agent", "agent.fail", runId, {
      skillId,
      agentId: agent?.id ?? null,
      error: message,
      toolCallCount: toolCalls.length
    });
    eventBus.emit("agent.failed", { id: runId, error: message });
    return {
      id: runId,
      skillId,
      agentId: agent?.id ?? null,
      status: "failed",
      input,
      output: null,
      error: message,
      toolCalls,
      startedAt: run.startedAt,
      completedAt: new Date()
    };
  }
}

function clampMax(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(0, Math.min(20, Math.floor(value)));
}

interface ExecuteParams {
  skill: SkillRecord;
  agent: AgentRecord | null;
  providerName: AiProviderName;
  input: Record<string, unknown>;
  maxToolCalls: number;
  toolCalls: AgentToolCall[];
}

async function executeRun(
  params: ExecuteParams
): Promise<{ text: string; provider: AiProviderName; model: string }> {
  const { skill, agent, providerName, input, maxToolCalls, toolCalls } = params;

  // Merge user input with any built-in context provider's variables.
  const ctxProvider = getSkillContextProvider(skill.id);
  const ctxVars = ctxProvider ? await ctxProvider(input) : {};
  const vars: Record<string, unknown> = { ...ctxVars, ...input };

  const userPrompt = skill.promptTemplate
    ? renderPromptTemplate(skill.promptTemplate, vars)
    : "";

  const messages: AiMessage[] = [];
  if (skill.systemPrompt) messages.push({ role: "system", content: skill.systemPrompt });
  if (userPrompt) messages.push({ role: "user", content: userPrompt });

  const provider = getProvider(providerName);

  // Build the tool set this skill is allowed to use, intersected with
  // currently connected integrations.
  const tools = skill.allowedTools.length
    ? await resolveAllowedTools(skill.allowedTools)
    : [];

  let iterations = 0;
  while (true) {
    const response = await provider.complete({
      messages,
      tools: tools.length ? tools : undefined,
      model: agent?.model ?? undefined
    });

    if (!response.toolCalls || response.toolCalls.length === 0) {
      return {
        text: response.text,
        provider: response.provider,
        model: response.model
      };
    }

    if (iterations >= maxToolCalls) {
      throw new Error(
        `Tool-call limit reached (${maxToolCalls}). Aborting to prevent runaway loops.`
      );
    }

    // Dispatch each requested tool call and append the result to the
    // conversation so the provider can continue reasoning.
    for (const call of response.toolCalls) {
      const allowed = skill.allowedTools.includes(call.toolId);
      const startedAt = new Date().toISOString();
      if (!allowed) {
        const record: AgentToolCall = {
          toolId: call.toolId,
          input: call.input,
          output: null,
          ok: false,
          error: "Tool not permitted by skill",
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
          (result.ok
            ? safeStringify(result.output)
            : result.error ?? "unknown error")
      });
    }

    iterations += 1;
  }
}

async function resolveAllowedTools(allowed: string[]): Promise<AgentTool[]> {
  const all = await listAgentTools();
  const allowSet = new Set(allowed);
  return all.filter((t) => allowSet.has(t.id));
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
