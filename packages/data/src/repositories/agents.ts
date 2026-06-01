import { asc, eq } from "drizzle-orm";
import type {
  AgentRecord,
  AgentSchedule,
  AiProviderName,
  CreateAgentInput,
  UpdateAgentInput
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { agents } from "../schema.js";

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Parse a stored schedule blob. Falls back to `{kind:"none"}` for any value
 * that doesn't match a known shape so an old/corrupt row can't crash the
 * agents page or the scheduler.
 */
function parseSchedule(value: string | null | undefined): AgentSchedule {
  if (!value) return { kind: "none" };
  try {
    const parsed = JSON.parse(value) as Partial<AgentSchedule> & {
      kind?: string;
    };
    if (parsed.kind === "every-minutes" && typeof parsed.minutes === "number") {
      return { kind: "every-minutes", minutes: Math.max(1, Math.round(parsed.minutes)) };
    }
    if (
      parsed.kind === "daily" &&
      typeof parsed.hour === "number" &&
      typeof parsed.minute === "number"
    ) {
      return {
        kind: "daily",
        hour: clamp(parsed.hour, 0, 23),
        minute: clamp(parsed.minute, 0, 59)
      };
    }
  } catch {
    /* fall through */
  }
  return { kind: "none" };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function rowToAgent(row: typeof agents.$inferSelect): AgentRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    provider: row.provider as AiProviderName,
    model: row.model ?? null,
    skillIds: safeJsonArray(row.skillIds),
    allowedTools: safeJsonArray(row.allowedTools),
    systemPrompt: row.systemPrompt,
    goal: row.goal,
    schedule: parseSchedule(row.schedule),
    maxToolCalls: row.maxToolCalls,
    isBuiltIn: row.isBuiltIn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listAgents(db: ElevatorDb): Promise<AgentRecord[]> {
  const rows = await db.select().from(agents).orderBy(asc(agents.name));
  return rows.map(rowToAgent);
}

export async function getAgent(db: ElevatorDb, id: string): Promise<AgentRecord | null> {
  const rows = await db.select().from(agents).where(eq(agents.id, id));
  return rows[0] ? rowToAgent(rows[0]) : null;
}

export async function createAgent(
  db: ElevatorDb,
  input: CreateAgentInput & { id?: string }
): Promise<AgentRecord> {
  const now = new Date();
  const id = input.id ?? crypto.randomUUID();
  const row = {
    id,
    name: input.name,
    description: input.description ?? "",
    provider: input.provider,
    model: input.model ?? null,
    skillIds: JSON.stringify(input.skillIds ?? []),
    allowedTools: JSON.stringify(input.allowedTools ?? []),
    systemPrompt: input.systemPrompt ?? "",
    goal: input.goal ?? "",
    schedule: JSON.stringify(input.schedule ?? { kind: "none" }),
    maxToolCalls: input.maxToolCalls ?? 5,
    isBuiltIn: input.isBuiltIn ?? false,
    createdAt: now,
    updatedAt: now
  };
  await db.insert(agents).values(row);
  return rowToAgent(row);
}

export async function updateAgent(
  db: ElevatorDb,
  id: string,
  input: UpdateAgentInput
): Promise<AgentRecord | null> {
  const existing = await getAgent(db, id);
  if (!existing) return null;
  const patch: Partial<typeof agents.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.provider !== undefined) patch.provider = input.provider;
  if (input.model !== undefined) patch.model = input.model;
  if (input.skillIds !== undefined) patch.skillIds = JSON.stringify(input.skillIds);
  if (input.allowedTools !== undefined)
    patch.allowedTools = JSON.stringify(input.allowedTools);
  if (input.systemPrompt !== undefined) patch.systemPrompt = input.systemPrompt;
  if (input.goal !== undefined) patch.goal = input.goal;
  if (input.schedule !== undefined) patch.schedule = JSON.stringify(input.schedule);
  if (input.maxToolCalls !== undefined) patch.maxToolCalls = input.maxToolCalls;
  await db.update(agents).set(patch).where(eq(agents.id, id));
  return getAgent(db, id);
}

export async function deleteAgent(db: ElevatorDb, id: string): Promise<boolean> {
  const existing = await getAgent(db, id);
  if (!existing) return false;
  if (existing.isBuiltIn) {
    throw new Error("Cannot delete a built-in agent");
  }
  await db.delete(agents).where(eq(agents.id, id));
  return true;
}
