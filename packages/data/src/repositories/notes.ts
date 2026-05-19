import { eq, isNull } from "drizzle-orm";
import type { Note, CreateNoteInput, UpdateNoteInput } from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { notes } from "../schema.js";

function rowToNote(row: typeof notes.$inferSelect): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags) as string[],
    isPinned: row.isPinned,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listNotes(db: ElevatorDb): Promise<Note[]> {
  const rows = await db.select().from(notes).where(isNull(notes.archivedAt));
  return rows.map(rowToNote);
}

export async function createNote(db: ElevatorDb, id: string, input: CreateNoteInput): Promise<Note> {
  const now = new Date();
  const row = {
    id,
    title: input.title,
    content: input.content ?? "",
    tags: JSON.stringify(input.tags ?? []),
    isPinned: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now
  };
  await db.insert(notes).values(row);
  return rowToNote(row);
}

export async function updateNote(
  db: ElevatorDb,
  id: string,
  updates: UpdateNoteInput
): Promise<Note | null> {
  const now = new Date();
  const patch: Partial<typeof notes.$inferInsert> = { updatedAt: now };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.content !== undefined) patch.content = updates.content;
  if (updates.tags !== undefined) patch.tags = JSON.stringify(updates.tags);
  if (updates.isPinned !== undefined) patch.isPinned = updates.isPinned;

  await db.update(notes).set(patch).where(eq(notes.id, id));
  const rows = await db.select().from(notes).where(eq(notes.id, id));
  return rows[0] ? rowToNote(rows[0]) : null;
}

export async function deleteNote(db: ElevatorDb, id: string): Promise<void> {
  await db.delete(notes).where(eq(notes.id, id));
}
