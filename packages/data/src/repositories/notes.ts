import { eq, isNull } from "drizzle-orm";
import type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  NoteContentJson
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { notes } from "../schema.js";

function parseContent(raw: string): NoteContentJson {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as NoteContentJson) : [];
  } catch {
    return [];
  }
}

function rowToNote(row: typeof notes.$inferSelect): Note {
  return {
    id: row.id,
    title: row.title,
    contentJson: parseContent(row.contentJson),
    tags: JSON.parse(row.tags) as string[],
    folderId: row.folderId ?? null,
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
    contentJson: JSON.stringify(input.contentJson ?? []),
    tags: JSON.stringify(input.tags ?? []),
    folderId: input.folderId ?? null,
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
  if (updates.contentJson !== undefined)
    patch.contentJson = JSON.stringify(updates.contentJson);
  if (updates.tags !== undefined) patch.tags = JSON.stringify(updates.tags);
  if (updates.folderId !== undefined) patch.folderId = updates.folderId;
  if (updates.isPinned !== undefined) patch.isPinned = updates.isPinned;

  await db.update(notes).set(patch).where(eq(notes.id, id));
  const rows = await db.select().from(notes).where(eq(notes.id, id));
  return rows[0] ? rowToNote(rows[0]) : null;
}

export async function deleteNote(db: ElevatorDb, id: string): Promise<void> {
  await db.delete(notes).where(eq(notes.id, id));
}
