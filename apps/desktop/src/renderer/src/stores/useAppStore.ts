import { create } from "zustand";
import type { AppInfo } from "@elevator/shared";

interface AppState {
  appInfo: AppInfo;
  paletteOpen: boolean;
  setAppInfo: (info: AppInfo) => void;
  openPalette: () => void;
  closePalette: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  appInfo: { name: "Elevator", version: "0.1.0" },
  paletteOpen: false,
  setAppInfo: (appInfo) => set({ appInfo }),
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
}));
