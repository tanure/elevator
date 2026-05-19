import { create } from "zustand";
import type { Note, CreateNoteInput, UpdateNoteInput } from "@elevator/shared";

interface NotesState {
  notes: Note[];
  selectedId: string | null;
  loading: boolean;
  load: () => Promise<void>;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: string, updates: UpdateNoteInput) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  selectNote: (id: string | null) => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  selectedId: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const notes = await window.elevator.notes.list();
      set({ notes });
    } finally {
      set({ loading: false });
    }
  },

  createNote: async (input) => {
    const note = await window.elevator.notes.create(input);
    await get().load();
    return note;
  },

  updateNote: async (id, updates) => {
    await window.elevator.notes.update(id, updates);
    await get().load();
  },

  deleteNote: async (id) => {
    await window.elevator.notes.delete(id);
    if (get().selectedId === id) set({ selectedId: null });
    await get().load();
  },

  selectNote: (id) => set({ selectedId: id }),
}));
