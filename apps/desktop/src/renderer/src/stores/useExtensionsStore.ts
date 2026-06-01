import { create } from "zustand";
import type {
  CreateExtensionInput,
  ExtensionRecord,
  UpdateExtensionInput
} from "@elevator/shared";

interface ExtensionsState {
  extensions: ExtensionRecord[];
  loading: boolean;
  load: () => Promise<void>;
  create: (input: CreateExtensionInput) => Promise<void>;
  update: (id: string, input: UpdateExtensionInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useExtensionsStore = create<ExtensionsState>((set, get) => ({
  extensions: [],
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const extensions = await window.elevator.extensions.list();
      set({ extensions });
    } finally {
      set({ loading: false });
    }
  },
  create: async (input) => {
    await window.elevator.extensions.create(input);
    await get().load();
  },
  update: async (id, input) => {
    await window.elevator.extensions.update(id, input);
    await get().load();
  },
  remove: async (id) => {
    await window.elevator.extensions.delete(id);
    await get().load();
  }
}));
