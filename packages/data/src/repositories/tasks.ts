import { eq } from "drizzle-orm";
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus } from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { tasks } from "../schema.js";

function rowToTask(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt ?? null,
    completedAt: row.completedAt ?? null,
    sourceExtension: row.sourceExtension ?? null,
    sourceId: row.sourceId ?? null,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listTasks(db: ElevatorDb): Promise<Task[]> {
  const rows = await db.select().from(tasks);
  return rows.map(rowToTask);
}

export async function createTask(db: ElevatorDb, id: string, input: CreateTaskInput): Promise<Task> {
  const now = new Date();
  const row = {
    id,
    title: input.title,
    description: input.description ?? null,
    status: "todo" as const,
    priority: input.priority ?? "medium",
    dueAt: input.dueAt ?? null,
    completedAt: null,
    sourceExtension: null,
    sourceId: null,
    metadata: "{}",
    createdAt: now,
    updatedAt: now
  };
  await db.insert(tasks).values(row);
  return rowToTask(row);
}

export async function updateTask(
  db: ElevatorDb,
  id: string,
  updates: UpdateTaskInput
): Promise<Task | null> {
  const now = new Date();
  const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: now };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.priority !== undefined) patch.priority = updates.priority;
  if ("dueAt" in updates) patch.dueAt = updates.dueAt ?? null;

  await db.update(tasks).set(patch).where(eq(tasks.id, id));
  const rows = await db.select().from(tasks).where(eq(tasks.id, id));
  return rows[0] ? rowToTask(rows[0]) : null;
}

export async function deleteTask(db: ElevatorDb, id: string): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function setTaskStatus(
  db: ElevatorDb,
  id: string,
  status: TaskStatus
): Promise<Task | null> {
  const now = new Date();
  const completedAt = status === "done" ? now : null;
  await db.update(tasks)
    .set({ status, completedAt, updatedAt: now })
    .where(eq(tasks.id, id));
  const rows = await db.select().from(tasks).where(eq(tasks.id, id));
  return rows[0] ? rowToTask(rows[0]) : null;
}
