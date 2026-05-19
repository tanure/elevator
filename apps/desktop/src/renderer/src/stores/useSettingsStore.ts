import { create } from "zustand";

interface SettingsState {
  settings: Record<string, string>;
  load: () => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;
  getSetting: (key: string) => string | undefined;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},

  load: async () => {
    const settings = await window.elevator.settings.getAll();
    set({ settings });
  },

  setSetting: async (key, value) => {
    await window.elevator.settings.set(key, value);
    set((s) => ({ settings: { ...s.settings, [key]: value } }));
  },

  getSetting: (key) => get().settings[key],
}));
