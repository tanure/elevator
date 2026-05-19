import { create } from "zustand";

export interface CardSlot {
  id: string;
  colSpan?: 1 | 2;
}

interface DashboardState {
  slots: CardSlot[];
}

export const useDashboardStore = create<DashboardState>(() => ({
  slots: [
    { id: "activity", colSpan: 2 },
    { id: "daily-brief", colSpan: 2 },
    { id: "agenda" },
    { id: "task-summary" },
    { id: "pinned-notes" },
    { id: "quick-actions" },
  ],
}));
