import { create } from "zustand";
import type {
  NoteFolder,
  CreateNoteFolderInput,
  UpdateNoteFolderInput
} from "@elevator/shared";

interface NoteFoldersState {
  folders: NoteFolder[];
  loading: boolean;
  load: () => Promise<void>;
  createFolder: (input: CreateNoteFolderInput) => Promise<NoteFolder>;
  updateFolder: (id: string, updates: UpdateNoteFolderInput) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useNoteFoldersStore = create<NoteFoldersState>((set, get) => ({
  folders: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const folders = await window.elevator.noteFolders.list();
      set({ folders });
    } finally {
      set({ loading: false });
    }
  },

  createFolder: async (input) => {
    const folder = await window.elevator.noteFolders.create(input);
    await get().load();
    return folder;
  },

  updateFolder: async (id, updates) => {
    await window.elevator.noteFolders.update(id, updates);
    await get().load();
  },

  deleteFolder: async (id) => {
    await window.elevator.noteFolders.delete(id);
    await get().load();
  }
}));
