import { create } from "zustand";
import type {
  AgentRecord,
  AgentRun,
  AgentTool,
  AiProviderName,
  CreateAgentInput,
  CreateSkillInput,
  SkillRecord,
  UpdateAgentInput,
  UpdateSkillInput
} from "@elevator/shared";

interface AgentsState {
  skills: SkillRecord[];
  agents: AgentRecord[];
  availableTools: AgentTool[];
  history: AgentRun[];
  providers: AiProviderName[];
  activeProvider: AiProviderName | null;
  lastRun: AgentRun | null;
  running: boolean;

  load: () => Promise<void>;

  createSkill: (input: CreateSkillInput) => Promise<SkillRecord>;
  updateSkill: (id: string, input: UpdateSkillInput) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  runSkill: (skillId: string, input?: Record<string, unknown>) => Promise<AgentRun>;

  createAgent: (input: CreateAgentInput) => Promise<AgentRecord>;
  updateAgent: (id: string, input: UpdateAgentInput) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  runAgent: (
    agentId: string,
    skillId: string,
    input?: Record<string, unknown>
  ) => Promise<AgentRun>;

  setProvider: (name: AiProviderName) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  skills: [],
  agents: [],
  availableTools: [],
  history: [],
  providers: [],
  activeProvider: null,
  lastRun: null,
  running: false,

  load: async () => {
    const [skills, agents, tools, history, providersInfo] = await Promise.all([
      window.elevator.skills.list(),
      window.elevator.agents.list(),
      window.elevator.agents.listAvailableTools(),
      window.elevator.agents.history(50),
      window.elevator.agents.listProviders()
    ]);
    set({
      skills,
      agents,
      availableTools: tools,
      history,
      providers: providersInfo.providers,
      activeProvider: providersInfo.active
    });
  },

  createSkill: async (input) => {
    const skill = await window.elevator.skills.create(input);
    await get().load();
    return skill;
  },
  updateSkill: async (id, input) => {
    await window.elevator.skills.update(id, input);
    await get().load();
  },
  deleteSkill: async (id) => {
    await window.elevator.skills.delete(id);
    await get().load();
  },
  runSkill: async (skillId, input = {}) => {
    set({ running: true });
    try {
      const run = await window.elevator.skills.run(skillId, input);
      set({ lastRun: run });
      await get().load();
      return run;
    } finally {
      set({ running: false });
    }
  },

  createAgent: async (input) => {
    const agent = await window.elevator.agents.create(input);
    await get().load();
    return agent;
  },
  updateAgent: async (id, input) => {
    await window.elevator.agents.update(id, input);
    await get().load();
  },
  deleteAgent: async (id) => {
    await window.elevator.agents.delete(id);
    await get().load();
  },
  runAgent: async (agentId, skillId, input = {}) => {
    set({ running: true });
    try {
      const run = await window.elevator.agents.runSkill(agentId, skillId, input);
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
