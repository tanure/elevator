import { create } from "zustand";
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus } from "@elevator/shared";

interface TasksState {
  tasks: Task[];
  loading: boolean;
  load: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (id: string, updates: UpdateTaskInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  setTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const tasks = await window.elevator.tasks.list();
      set({ tasks });
    } finally {
      set({ loading: false });
    }
  },

  createTask: async (input) => {
    await window.elevator.tasks.create(input);
    await get().load();
  },

  updateTask: async (id, updates) => {
    await window.elevator.tasks.update(id, updates);
    await get().load();
  },

  deleteTask: async (id) => {
    await window.elevator.tasks.delete(id);
    await get().load();
  },

  setTaskStatus: async (id, status) => {
    await window.elevator.tasks.setStatus(id, status);
    await get().load();
  },
}));
