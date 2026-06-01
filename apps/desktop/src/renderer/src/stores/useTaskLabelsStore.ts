import { create } from "zustand";
import type {
  TaskLabel,
  CreateTaskLabelInput,
  UpdateTaskLabelInput
} from "@elevator/shared";

interface TaskLabelsState {
  labels: TaskLabel[];
  loading: boolean;
  load: () => Promise<void>;
  createLabel: (input: CreateTaskLabelInput) => Promise<void>;
  updateLabel: (id: string, updates: UpdateTaskLabelInput) => Promise<void>;
  deleteLabel: (id: string) => Promise<void>;
}

export const useTaskLabelsStore = create<TaskLabelsState>((set, get) => ({
  labels: [],
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const labels = await window.elevator.taskLabels.list();
      set({ labels });
    } finally {
      set({ loading: false });
    }
  },
  createLabel: async (input) => {
    await window.elevator.taskLabels.create(input);
    await get().load();
  },
  updateLabel: async (id, updates) => {
    await window.elevator.taskLabels.update(id, updates);
    await get().load();
  },
  deleteLabel: async (id) => {
    await window.elevator.taskLabels.delete(id);
    await get().load();
  }
}));
