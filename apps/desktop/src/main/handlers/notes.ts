import { ipcMain } from "electron";
import {
  createNote,
  createNoteFolder,
  deleteNote,
  deleteNoteFolder,
  listNoteFolders,
  listNotes,
  updateNote,
  updateNoteFolder
} from "@elevator/data";
import type {
  CreateNoteFolderInput,
  CreateNoteInput,
  Note,
  NoteFolder,
  UpdateNoteFolderInput,
  UpdateNoteInput
} from "@elevator/shared";
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

  ipcMain.handle("noteFolders:list", async (): Promise<NoteFolder[]> => {
    return listNoteFolders(getDb());
  });

  ipcMain.handle(
    "noteFolders:create",
    async (_event, input: CreateNoteFolderInput): Promise<NoteFolder> => {
      const id = crypto.randomUUID();
      const folder = await createNoteFolder(getDb(), id, input);
      eventBus.emit("note.folder.created", { id });
      return folder;
    }
  );

  ipcMain.handle(
    "noteFolders:update",
    async (
      _event,
      id: string,
      updates: UpdateNoteFolderInput
    ): Promise<NoteFolder | null> => {
      const folder = await updateNoteFolder(getDb(), id, updates);
      if (folder) eventBus.emit("note.folder.updated", { id });
      return folder;
    }
  );

  ipcMain.handle("noteFolders:delete", async (_event, id: string): Promise<void> => {
    await deleteNoteFolder(getDb(), id);
    eventBus.emit("note.folder.deleted", { id });
  });
}
