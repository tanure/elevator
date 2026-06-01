import { eq, inArray } from "drizzle-orm";
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { tasks, taskTaskLabels } from "../schema.js";

function rowToTask(
  row: typeof tasks.$inferSelect,
  labelIds: string[]
): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    startAt: row.startAt ?? null,
    dueAt: row.dueAt ?? null,
    completedAt: row.completedAt ?? null,
    sourceExtension: row.sourceExtension ?? null,
    sourceId: row.sourceId ?? null,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    labelIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function loadLabelMap(
  db: ElevatorDb,
  taskIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const id of taskIds) map.set(id, []);
  if (taskIds.length === 0) return map;
  const rows = await db
    .select()
    .from(taskTaskLabels)
    .where(inArray(taskTaskLabels.taskId, taskIds));
  for (const r of rows) {
    const list = map.get(r.taskId) ?? [];
    list.push(r.labelId);
    map.set(r.taskId, list);
  }
  return map;
}

async function setTaskLabelIds(
  db: ElevatorDb,
  taskId: string,
  labelIds: string[]
): Promise<void> {
  await db.delete(taskTaskLabels).where(eq(taskTaskLabels.taskId, taskId));
  if (labelIds.length === 0) return;
  const unique = Array.from(new Set(labelIds));
  await db
    .insert(taskTaskLabels)
    .values(unique.map((labelId) => ({ taskId, labelId })));
}

async function getTaskById(db: ElevatorDb, id: string): Promise<Task | null> {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!rows[0]) return null;
  const labelMap = await loadLabelMap(db, [id]);
  return rowToTask(rows[0], labelMap.get(id) ?? []);
}

export async function listTasks(db: ElevatorDb): Promise<Task[]> {
  const rows = await db.select().from(tasks);
  const labelMap = await loadLabelMap(
    db,
    rows.map((r) => r.id)
  );
  return rows.map((r) => rowToTask(r, labelMap.get(r.id) ?? []));
}

export async function createTask(
  db: ElevatorDb,
  id: string,
  input: CreateTaskInput
): Promise<Task> {
  const now = new Date();
  const row = {
    id,
    title: input.title,
    description: input.description ?? null,
    status: "todo" as const,
    priority: input.priority ?? "medium",
    startAt: input.startAt ?? null,
    dueAt: input.dueAt ?? null,
    completedAt: null,
    sourceExtension: null,
    sourceId: null,
    metadata: "{}",
    createdAt: now,
    updatedAt: now
  };
  await db.insert(tasks).values(row);
  if (input.labelIds && input.labelIds.length > 0) {
    await setTaskLabelIds(db, id, input.labelIds);
  }
  return rowToTask(row, input.labelIds ?? []);
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
  if (updates.status !== undefined) {
    patch.status = updates.status;
    patch.completedAt = updates.status === "done" ? now : null;
  }
  if ("startAt" in updates) patch.startAt = updates.startAt ?? null;
  if ("dueAt" in updates) patch.dueAt = updates.dueAt ?? null;

  await db.update(tasks).set(patch).where(eq(tasks.id, id));
  if (updates.labelIds !== undefined) {
    await setTaskLabelIds(db, id, updates.labelIds);
  }
  return getTaskById(db, id);
}

export async function deleteTask(db: ElevatorDb, id: string): Promise<void> {
  await db.delete(taskTaskLabels).where(eq(taskTaskLabels.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function setTaskStatus(
  db: ElevatorDb,
  id: string,
  status: TaskStatus
): Promise<Task | null> {
  const now = new Date();
  const completedAt = status === "done" ? now : null;
  await db
    .update(tasks)
    .set({ status, completedAt, updatedAt: now })
    .where(eq(tasks.id, id));
  return getTaskById(db, id);
}
