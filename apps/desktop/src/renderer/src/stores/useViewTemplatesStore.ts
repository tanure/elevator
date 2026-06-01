import { create } from "zustand";
import type {
  CreateViewTemplateInput,
  UpdateViewTemplateInput,
  ViewTemplate
} from "@elevator/shared";

interface ViewTemplatesState {
  templates: ViewTemplate[];
  loading: boolean;
  load: () => Promise<void>;
  create: (input: CreateViewTemplateInput) => Promise<void>;
  update: (id: string, input: UpdateViewTemplateInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  createFromView: (
    viewId: string,
    input: { name: string; description?: string }
  ) => Promise<ViewTemplate>;
}

export const useViewTemplatesStore = create<ViewTemplatesState>((set, get) => ({
  templates: [],
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const templates = await window.elevator.viewTemplates.list();
      set({ templates });
    } finally {
      set({ loading: false });
    }
  },
  create: async (input) => {
    await window.elevator.viewTemplates.create(input);
    await get().load();
  },
  update: async (id, input) => {
    await window.elevator.viewTemplates.update(id, input);
    await get().load();
  },
  remove: async (id) => {
    await window.elevator.viewTemplates.delete(id);
    await get().load();
  },
  createFromView: async (viewId, input) => {
    const tpl = await window.elevator.viewTemplates.createFromView(viewId, input);
    await get().load();
    return tpl;
  }
}));
