import { randomUUID } from "node:crypto";
import {
  appendAuditLog,
  completeAgentRun,
  createAgentRun,
  failAgentRun
} from "@elevator/data";
import type { AgentRun } from "@elevator/shared";
import { getDb } from "../db.js";
import { eventBus } from "../event-bus.js";
import { getProvider } from "./registry.js";
import { getSkill } from "./skills.js";

export async function runSkill(
  skillId: string,
  input: Record<string, unknown> = {}
): Promise<AgentRun> {
  const db = getDb();
  const skill = getSkill(skillId);
  if (!skill) {
    throw new Error(`Unknown skill: ${skillId}`);
  }

  const id = randomUUID();
  const run = await createAgentRun(db, { id, skillId, input });
  await appendAuditLog(db, "agent", "agent.start", id, { skillId });

  try {
    const ctx = await skill.build(input);
    const provider = getProvider();
    const response = await provider.complete({
      messages: [
        { role: "system", content: ctx.systemPrompt },
        { role: "user", content: ctx.prompt }
      ]
    });
    await completeAgentRun(db, id, { output: response.text });
    await appendAuditLog(db, "agent", "agent.complete", id, {
      skillId,
      provider: response.provider,
      model: response.model
    });
    eventBus.emit("agent.completed", { id });
    return {
      id,
      skillId,
      status: "succeeded",
      input,
      output: response.text,
      error: null,
      startedAt: run.startedAt,
      completedAt: new Date()
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failAgentRun(db, id, message);
    await appendAuditLog(db, "agent", "agent.fail", id, { skillId, error: message });
    eventBus.emit("agent.failed", { id, error: message });
    return {
      id,
      skillId,
      status: "failed",
      input,
      output: null,
      error: message,
      startedAt: run.startedAt,
      completedAt: new Date()
    };
  }
}
