import { and, desc, eq } from "drizzle-orm";
import type {
  TaskSuggestion,
  TaskSuggestionStatus,
  CreateTaskSuggestionInput
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { taskSuggestions } from "../schema.js";

function rowToSuggestion(
  row: typeof taskSuggestions.$inferSelect
): TaskSuggestion {
  return {
    id: row.id,
    agentId: row.agentId ?? null,
    agentRunId: row.agentRunId ?? null,
    title: row.title,
    description: row.description ?? null,
    priority: row.priority,
    dueAt: row.dueAt ?? null,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? null
  };
}

export async function listTaskSuggestions(
  db: ElevatorDb,
  status?: TaskSuggestionStatus
): Promise<TaskSuggestion[]> {
  const rows = status
    ? await db
        .select()
        .from(taskSuggestions)
        .where(eq(taskSuggestions.status, status))
        .orderBy(desc(taskSuggestions.createdAt))
    : await db
        .select()
        .from(taskSuggestions)
        .orderBy(desc(taskSuggestions.createdAt));
  return rows.map(rowToSuggestion);
}

export async function createTaskSuggestion(
  db: ElevatorDb,
  id: string,
  input: CreateTaskSuggestionInput
): Promise<TaskSuggestion> {
  const now = new Date();
  const row = {
    id,
    agentId: input.agentId ?? null,
    agentRunId: input.agentRunId ?? null,
    title: input.title,
    description: input.description ?? null,
    priority: input.priority ?? "medium",
    dueAt: input.dueAt ?? null,
    status: "pending" as const,
    createdAt: now,
    resolvedAt: null
  };
  await db.insert(taskSuggestions).values(row);
  return rowToSuggestion(row);
}

export async function setTaskSuggestionStatus(
  db: ElevatorDb,
  id: string,
  status: TaskSuggestionStatus
): Promise<TaskSuggestion | null> {
  const now = new Date();
  await db
    .update(taskSuggestions)
    .set({ status, resolvedAt: status === "pending" ? null : now })
    .where(eq(taskSuggestions.id, id));
  const rows = await db
    .select()
    .from(taskSuggestions)
    .where(eq(taskSuggestions.id, id));
  return rows[0] ? rowToSuggestion(rows[0]) : null;
}

export async function deleteTaskSuggestion(
  db: ElevatorDb,
  id: string
): Promise<void> {
  await db.delete(taskSuggestions).where(eq(taskSuggestions.id, id));
}

export async function purgeResolvedSuggestions(db: ElevatorDb): Promise<void> {
  await db
    .delete(taskSuggestions)
    .where(
      and(
        eq(taskSuggestions.status, "dismissed")
      )
    );
}
