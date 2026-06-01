import { and, desc, eq } from "drizzle-orm";
import type { AgentRun, AgentRunStatus, AgentToolCall } from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { agentRuns } from "../schema.js";

function rowToRun(row: typeof agentRuns.$inferSelect): AgentRun {
  let toolCalls: AgentToolCall[] = [];
  try {
    const parsed = JSON.parse(row.toolCalls ?? "[]") as unknown;
    if (Array.isArray(parsed)) toolCalls = parsed as AgentToolCall[];
  } catch {
    toolCalls = [];
  }
  return {
    id: row.id,
    skillId: row.skillId,
    agentId: row.agentId ?? null,
    status: row.status as AgentRunStatus,
    input: JSON.parse(row.input) as Record<string, unknown>,
    output: row.output ?? null,
    error: row.error ?? null,
    toolCalls,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? null
  };
}

export async function listAgentRuns(
  db: ElevatorDb,
  opts: { limit?: number } = {}
): Promise<AgentRun[]> {
  const rows = await db
    .select()
    .from(agentRuns)
    .orderBy(desc(agentRuns.startedAt))
    .limit(opts.limit ?? 50);
  return rows.map(rowToRun);
}

export async function getAgentRun(db: ElevatorDb, id: string): Promise<AgentRun | null> {
  const rows = await db.select().from(agentRuns).where(eq(agentRuns.id, id));
  return rows[0] ? rowToRun(rows[0]) : null;
}

/**
 * Return the most recent successful run for a given agent (most recent by
 * `startedAt`), or `null` if the agent has never produced one. Used by
 * extension cards to render the latest snapshot of an agent's output.
 */
export async function getLatestSuccessfulRunForAgent(
  db: ElevatorDb,
  agentId: string
): Promise<AgentRun | null> {
  const rows = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.agentId, agentId), eq(agentRuns.status, "succeeded")))
    .orderBy(desc(agentRuns.startedAt))
    .limit(1);
  return rows[0] ? rowToRun(rows[0]) : null;
}

export async function createAgentRun(
  db: ElevatorDb,
  input: {
    id: string;
    skillId: string;
    agentId?: string | null;
    input: Record<string, unknown>;
  }
): Promise<AgentRun> {
  const row = {
    id: input.id,
    skillId: input.skillId,
    agentId: input.agentId ?? null,
    status: "running" as const,
    input: JSON.stringify(input.input ?? {}),
    output: null,
    error: null,
    toolCalls: "[]",
    startedAt: new Date(),
    completedAt: null
  };
  await db.insert(agentRuns).values(row);
  return rowToRun(row);
}

export async function completeAgentRun(
  db: ElevatorDb,
  id: string,
  result: { output: string; toolCalls?: AgentToolCall[] }
): Promise<void> {
  await db
    .update(agentRuns)
    .set({
      status: "succeeded",
      output: result.output,
      toolCalls: JSON.stringify(result.toolCalls ?? []),
      completedAt: new Date()
    })
    .where(eq(agentRuns.id, id));
}

export async function failAgentRun(
  db: ElevatorDb,
  id: string,
  error: string,
  opts: { toolCalls?: AgentToolCall[] } = {}
): Promise<void> {
  await db
    .update(agentRuns)
    .set({
      status: "failed",
      error,
      toolCalls: JSON.stringify(opts.toolCalls ?? []),
      completedAt: new Date()
    })
    .where(eq(agentRuns.id, id));
}
