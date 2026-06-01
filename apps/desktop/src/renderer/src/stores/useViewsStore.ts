import { create } from "zustand";
import type {
  CreateViewInput,
  UpdateViewInput,
  ViewRecord
} from "@elevator/shared";

interface ViewsState {
  views: ViewRecord[];
  loading: boolean;
  load: () => Promise<void>;
  create: (input: CreateViewInput) => Promise<ViewRecord>;
  update: (id: string, input: UpdateViewInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  createFromTemplate: (
    templateId: string,
    input: { name: string; parameters: Record<string, unknown>; groupName?: string }
  ) => Promise<ViewRecord>;
}

export const useViewsStore = create<ViewsState>((set, get) => ({
  views: [],
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const views = await window.elevator.views.list();
      set({ views });
    } finally {
      set({ loading: false });
    }
  },
  create: async (input) => {
    const view = await window.elevator.views.create(input);
    await get().load();
    return view;
  },
  update: async (id, input) => {
    await window.elevator.views.update(id, input);
    await get().load();
  },
  remove: async (id) => {
    await window.elevator.views.delete(id);
    await get().load();
  },
  createFromTemplate: async (templateId, input) => {
    const view = await window.elevator.views.createFromTemplate(templateId, input);
    await get().load();
    return view;
  }
}));
