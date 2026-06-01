import { create } from "zustand";
import type {
  TaskSuggestion,
  TaskSuggestionStatus,
  CreateTaskSuggestionInput
} from "@elevator/shared";

interface TaskSuggestionsState {
  suggestions: TaskSuggestion[];
  loading: boolean;
  load: (status?: TaskSuggestionStatus) => Promise<void>;
  createSuggestion: (input: CreateTaskSuggestionInput) => Promise<void>;
  acceptSuggestion: (id: string) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  deleteSuggestion: (id: string) => Promise<void>;
}

export const useTaskSuggestionsStore = create<TaskSuggestionsState>(
  (set, get) => ({
    suggestions: [],
    loading: false,
    load: async (status) => {
      set({ loading: true });
      try {
        const suggestions = await window.elevator.taskSuggestions.list(status);
        set({ suggestions });
      } finally {
        set({ loading: false });
      }
    },
    createSuggestion: async (input) => {
      await window.elevator.taskSuggestions.create(input);
      await get().load("pending");
    },
    acceptSuggestion: async (id) => {
      await window.elevator.taskSuggestions.accept(id);
      await get().load("pending");
    },
    dismissSuggestion: async (id) => {
      await window.elevator.taskSuggestions.setStatus(id, "dismissed");
      await get().load("pending");
    },
    deleteSuggestion: async (id) => {
      await window.elevator.taskSuggestions.delete(id);
      await get().load("pending");
    }
  })
);
