import { eq } from "drizzle-orm";
import type {
  NoteFolder,
  CreateNoteFolderInput,
  UpdateNoteFolderInput
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { noteFolders } from "../schema.js";

function rowToFolder(row: typeof noteFolders.$inferSelect): NoteFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listNoteFolders(db: ElevatorDb): Promise<NoteFolder[]> {
  const rows = await db.select().from(noteFolders);
  return rows.map(rowToFolder);
}

export async function createNoteFolder(
  db: ElevatorDb,
  id: string,
  input: CreateNoteFolderInput
): Promise<NoteFolder> {
  const now = new Date();
  const row = {
    id,
    name: input.name,
    parentId: input.parentId ?? null,
    createdAt: now,
    updatedAt: now
  };
  await db.insert(noteFolders).values(row);
  return rowToFolder(row);
}

export async function updateNoteFolder(
  db: ElevatorDb,
  id: string,
  updates: UpdateNoteFolderInput
): Promise<NoteFolder | null> {
  const now = new Date();
  const patch: Partial<typeof noteFolders.$inferInsert> = { updatedAt: now };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.parentId !== undefined) patch.parentId = updates.parentId;
  await db.update(noteFolders).set(patch).where(eq(noteFolders.id, id));
  const rows = await db.select().from(noteFolders).where(eq(noteFolders.id, id));
  return rows[0] ? rowToFolder(rows[0]) : null;
}

export async function deleteNoteFolder(db: ElevatorDb, id: string): Promise<void> {
  await db.delete(noteFolders).where(eq(noteFolders.id, id));
}
