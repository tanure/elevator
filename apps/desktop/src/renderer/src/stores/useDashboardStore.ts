import { create } from "zustand";
import type {
  DashboardLayout,
  DashboardSlot,
  ExtensionRecord
} from "@elevator/shared";

/** Default layout used when none has been persisted yet. */
export const DEFAULT_SLOTS: DashboardSlot[] = [
  { cardId: "activity", colSpan: 2 },
  { cardId: "daily-brief", colSpan: 2 },
  { cardId: "upcoming-events", colSpan: 1 },
  { cardId: "task-summary", colSpan: 1 },
  { cardId: "pinned-notes", colSpan: 1 },
  { cardId: "quick-actions", colSpan: 1 }
];

interface DashboardState {
  /** The active layout for the main dashboard (viewId = null). */
  layout: DashboardLayout | null;
  /** Extensions visible as additional cards. */
  extensions: ExtensionRecord[];
  loading: boolean;
  saving: boolean;
  load: () => Promise<void>;
  addSlot: (cardId: string, colSpan?: 1 | 2) => Promise<void>;
  removeSlot: (index: number) => Promise<void>;
  moveSlot: (from: number, to: number) => Promise<void>;
  setSlotColSpan: (index: number, colSpan: 1 | 2) => Promise<void>;
  reload: () => Promise<void>;
}

async function persistSlots(
  layout: DashboardLayout | null,
  slots: DashboardSlot[]
): Promise<DashboardLayout> {
  if (!layout) {
    return window.elevator.dashboardLayouts.create({
      name: "Dashboard",
      viewId: null,
      slots,
      isActive: true
    });
  }
  const updated = await window.elevator.dashboardLayouts.update(layout.id, {
    slots,
    isActive: true
  });
  return updated ?? layout;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  layout: null,
  extensions: [],
  loading: false,
  saving: false,

  load: async () => {
    set({ loading: true });
    try {
      let active = await window.elevator.dashboardLayouts.getActive(null);
      if (!active) {
        active = await window.elevator.dashboardLayouts.create({
          name: "Dashboard",
          viewId: null,
          slots: DEFAULT_SLOTS,
          isActive: true
        });
      }
      const extensions = await window.elevator.extensions.list();
      set({ layout: active, extensions });
    } finally {
      set({ loading: false });
    }
  },

  reload: async () => {
    const extensions = await window.elevator.extensions.list();
    const active = await window.elevator.dashboardLayouts.getActive(null);
    set({ layout: active, extensions });
  },

  addSlot: async (cardId, colSpan = 1) => {
    const { layout } = get();
    const next: DashboardSlot[] = [...(layout?.slots ?? []), { cardId, colSpan }];
    set({ saving: true });
    try {
      const updated = await persistSlots(layout, next);
      set({ layout: updated });
    } finally {
      set({ saving: false });
    }
  },

  removeSlot: async (index) => {
    const { layout } = get();
    if (!layout) return;
    const next = layout.slots.filter((_, i) => i !== index);
    set({ saving: true });
    try {
      const updated = await persistSlots(layout, next);
      set({ layout: updated });
    } finally {
      set({ saving: false });
    }
  },

  moveSlot: async (from, to) => {
    const { layout } = get();
    if (!layout) return;
    if (from === to) return;
    const next = [...layout.slots];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
    set({ saving: true });
    try {
      const updated = await persistSlots(layout, next);
      set({ layout: updated });
    } finally {
      set({ saving: false });
    }
  },

  setSlotColSpan: async (index, colSpan) => {
    const { layout } = get();
    if (!layout) return;
    const next = layout.slots.map((slot, i) =>
      i === index ? { ...slot, colSpan } : slot
    );
    set({ saving: true });
    try {
      const updated = await persistSlots(layout, next);
      set({ layout: updated });
    } finally {
      set({ saving: false });
    }
  }
}));
