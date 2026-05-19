import { ipcMain } from "electron";
import { createNote, deleteNote, listNotes, updateNote } from "@elevator/data";
import type { CreateNoteInput, Note, UpdateNoteInput } from "@elevator/shared";
import { getDb } from "../db.js";
import { eventBus } from "../event-bus.js";

export function registerNoteHandlers(): void {
  ipcMain.handle("notes:list", async (): Promise<Note[]> => {
    return listNotes(getDb());
  });

  ipcMain.handle("notes:create", async (_event, input: CreateNoteInput): Promise<Note> => {
    const id = crypto.randomUUID();
    const note = await createNote(getDb(), id, input);
    eventBus.emit("note.created", { id });
    return note;
  });

  ipcMain.handle(
    "notes:update",
    async (_event, id: string, updates: UpdateNoteInput): Promise<Note | null> => {
      const note = await updateNote(getDb(), id, updates);
      if (note) eventBus.emit("note.updated", { id });
      return note;
    }
  );

  ipcMain.handle("notes:delete", async (_event, id: string): Promise<void> => {
    await deleteNote(getDb(), id);
    eventBus.emit("note.deleted", { id });
  });
}
