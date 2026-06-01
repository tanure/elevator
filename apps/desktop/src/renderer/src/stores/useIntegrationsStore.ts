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
  contextProviders: Record<
    string,
    { providers: ToolDescriptor[]; disabled: string[] }
  >;
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
  setContextProviderEnabled: (
    instanceId: string,
    providerId: string,
    enabled: boolean
  ) => Promise<void>;
}

export const useIntegrationsStore = create<IntegrationsState>((set, get) => ({
  integrations: [],
  templates: [],
  tools: [],
  contextProviders: {},
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
      const entries = await Promise.all(
        integrations.map(async (i) => {
          const cp = await window.elevator.integrations.listContextProviders(i.id);
          return [i.id, cp] as const;
        })
      );
      const contextProviders: Record<
        string,
        { providers: ToolDescriptor[]; disabled: string[] }
      > = {};
      for (const [id, cp] of entries) contextProviders[id] = cp;
      set({ integrations, templates, tools, contextProviders });
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
  },

  setContextProviderEnabled: async (instanceId, providerId, enabled) => {
    await window.elevator.integrations.setContextProviderEnabled(
      instanceId,
      providerId,
      enabled
    );
    await get().load();
  }
}));
