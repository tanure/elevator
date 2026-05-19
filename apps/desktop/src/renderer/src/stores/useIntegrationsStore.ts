import { create } from "zustand";
import type {
  ConnectorTemplate,
  CreateIntegrationInstanceInput,
  Integration,
  IntegrationHealth,
  IntegrationMutationResult,
  ToolDescriptor,
  UpdateIntegrationInstanceInput
} from "@elevator/shared";

interface IntegrationsState {
  integrations: Integration[];
  templates: ConnectorTemplate[];
  tools: ToolDescriptor[];
  health: Record<string, IntegrationHealth>;
  loading: boolean;
  load: () => Promise<void>;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  check: (id: string) => Promise<void>;
  sync: (id: string) => Promise<void>;
  create: (input: CreateIntegrationInstanceInput) => Promise<IntegrationMutationResult>;
  update: (
    id: string,
    input: UpdateIntegrationInstanceInput
  ) => Promise<IntegrationMutationResult>;
  remove: (id: string) => Promise<void>;
  test: (
    templateId: string,
    config: Record<string, unknown>,
    existingInstanceId?: string
  ) => Promise<IntegrationHealth>;
}

export const useIntegrationsStore = create<IntegrationsState>((set, get) => ({
  integrations: [],
  templates: [],
  tools: [],
  health: {},
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const [integrations, templates, tools] = await Promise.all([
        window.elevator.integrations.list(),
        window.elevator.integrations.listTemplates(),
        window.elevator.integrations.listTools()
      ]);
      set({ integrations, templates, tools });
    } finally {
      set({ loading: false });
    }
  },

  connect: async (id) => {
    const result = await window.elevator.integrations.connect(id);
    set((s) => ({ health: { ...s.health, [id]: result } }));
    await get().load();
  },

  disconnect: async (id) => {
    await window.elevator.integrations.disconnect(id);
    await get().load();
  },

  check: async (id) => {
    const result = await window.elevator.integrations.check(id);
    set((s) => ({ health: { ...s.health, [id]: result } }));
    await get().load();
  },

  sync: async (id) => {
    const result = await window.elevator.integrations.sync(id);
    set((s) => ({ health: { ...s.health, [id]: result } }));
    await get().load();
  },

  create: async (input) => {
    const result = await window.elevator.integrations.create(input);
    if (result.ok) await get().load();
    return result;
  },

  update: async (id, input) => {
    const result = await window.elevator.integrations.update(id, input);
    if (result.ok) await get().load();
    return result;
  },

  remove: async (id) => {
    await window.elevator.integrations.delete(id);
    await get().load();
  },

  test: async (templateId, config, existingInstanceId) => {
    return window.elevator.integrations.test(templateId, config, existingInstanceId);
  }
}));
