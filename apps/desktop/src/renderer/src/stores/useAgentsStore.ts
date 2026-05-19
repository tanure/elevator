import { create } from "zustand";
import type { AgentRun, AiProviderName, SkillManifest } from "@elevator/shared";

interface AgentsState {
  skills: SkillManifest[];
  providers: AiProviderName[];
  activeProvider: AiProviderName | null;
  history: AgentRun[];
  lastRun: AgentRun | null;
  running: boolean;
  load: () => Promise<void>;
  run: (skillId: string, input?: Record<string, unknown>) => Promise<AgentRun>;
  setProvider: (name: AiProviderName) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  skills: [],
  providers: [],
  activeProvider: null,
  history: [],
  lastRun: null,
  running: false,

  load: async () => {
    const [skills, providersInfo, history] = await Promise.all([
      window.elevator.agents.listSkills(),
      window.elevator.agents.listProviders(),
      window.elevator.agents.history(50)
    ]);
    set({
      skills,
      providers: providersInfo.providers,
      activeProvider: providersInfo.active,
      history
    });
  },

  run: async (skillId, input = {}) => {
    set({ running: true });
    try {
      const run = await window.elevator.agents.run(skillId, input);
      set({ lastRun: run });
      await get().load();
      return run;
    } finally {
      set({ running: false });
    }
  },

  setProvider: async (name) => {
    const result = await window.elevator.agents.setProvider(name);
    set({ activeProvider: result.active });
  }
}));
