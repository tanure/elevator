import { eq } from "drizzle-orm";
import type {
  TaskLabel,
  CreateTaskLabelInput,
  UpdateTaskLabelInput
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { taskLabels } from "../schema.js";

function rowToLabel(row: typeof taskLabels.$inferSelect): TaskLabel {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listTaskLabels(db: ElevatorDb): Promise<TaskLabel[]> {
  const rows = await db.select().from(taskLabels);
  return rows.map(rowToLabel);
}

export async function createTaskLabel(
  db: ElevatorDb,
  id: string,
  input: CreateTaskLabelInput
): Promise<TaskLabel> {
  const now = new Date();
  const row = {
    id,
    name: input.name,
    color: input.color || "#64748b",
    createdAt: now,
    updatedAt: now
  };
  await db.insert(taskLabels).values(row);
  return rowToLabel(row);
}

export async function updateTaskLabel(
  db: ElevatorDb,
  id: string,
  updates: UpdateTaskLabelInput
): Promise<TaskLabel | null> {
  const now = new Date();
  const patch: Partial<typeof taskLabels.$inferInsert> = { updatedAt: now };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.color !== undefined) patch.color = updates.color;
  await db.update(taskLabels).set(patch).where(eq(taskLabels.id, id));
  const rows = await db.select().from(taskLabels).where(eq(taskLabels.id, id));
  return rows[0] ? rowToLabel(rows[0]) : null;
}

export async function deleteTaskLabel(db: ElevatorDb, id: string): Promise<void> {
  await db.delete(taskLabels).where(eq(taskLabels.id, id));
}
