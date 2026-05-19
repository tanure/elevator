import { desc, eq } from "drizzle-orm";
import type { AgentRun, AgentRunStatus } from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { agentRuns } from "../schema.js";

function rowToRun(row: typeof agentRuns.$inferSelect): AgentRun {
  return {
    id: row.id,
    skillId: row.skillId,
    status: row.status as AgentRunStatus,
    input: JSON.parse(row.input) as Record<string, unknown>,
    output: row.output ?? null,
    error: row.error ?? null,
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

export async function createAgentRun(
  db: ElevatorDb,
  input: { id: string; skillId: string; input: Record<string, unknown> }
): Promise<AgentRun> {
  const row = {
    id: input.id,
    skillId: input.skillId,
    status: "running" as const,
    input: JSON.stringify(input.input ?? {}),
    output: null,
    error: null,
    startedAt: new Date(),
    completedAt: null
  };
  await db.insert(agentRuns).values(row);
  return rowToRun(row);
}

export async function completeAgentRun(
  db: ElevatorDb,
  id: string,
  result: { output: string }
): Promise<void> {
  await db
    .update(agentRuns)
    .set({ status: "succeeded", output: result.output, completedAt: new Date() })
    .where(eq(agentRuns.id, id));
}

export async function failAgentRun(
  db: ElevatorDb,
  id: string,
  error: string
): Promise<void> {
  await db
    .update(agentRuns)
    .set({ status: "failed", error, completedAt: new Date() })
    .where(eq(agentRuns.id, id));
}
