import { create } from "zustand";
import type { UpdateState } from "@elevator/shared";

interface UpdatesStore {
  state: UpdateState;
  initialized: boolean;
  dismissedVersion: string | null;
  init: () => Promise<void>;
  check: () => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
}

const initialState: UpdateState = {
  status: "idle",
  currentVersion: "",
  availableVersion: null,
  releaseNotes: null,
  releaseDate: null,
  progress: null,
  error: null,
  lastCheckedAt: null
};

export const useUpdatesStore = create<UpdatesStore>((set, get) => ({
  state: initialState,
  initialized: false,
  dismissedVersion: null,

  init: async () => {
    if (get().initialized) return;
    set({ initialized: true });
    window.elevator.on.updateState((state) => set({ state }));
    const state = await window.elevator.updates.getState();
    set({ state });
  },

  check: async () => {
    const state = await window.elevator.updates.check(true);
    set({ state });
  },

  install: async () => {
    await window.elevator.updates.install();
  },

  dismiss: () => {
    const { state } = get();
    if (state.availableVersion) {
      set({ dismissedVersion: state.availableVersion });
    }
  }
}));
