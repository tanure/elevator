import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentRun,
  AiProviderName,
  AppInfo,
  AuditLogEntry,
  ConnectorTemplate,
  CreateNoteInput,
  CreateTaskInput,
  CreateIntegrationInstanceInput,
  Integration,
  IntegrationHealth,
  IntegrationMutationResult,
  IntegrationSyncData,
  Job,
  Note,
  SkillManifest,
  Task,
  TaskStatus,
  ToolCallResult,
  ToolDescriptor,
  UpdateIntegrationInstanceInput,
  UpdateNoteInput,
  UpdateState,
  UpdateTaskInput
} from "@elevator/shared";

const elevatorApi = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:getInfo"),

  shell: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke("shell:openExternal", url)
  },

  settings: {
    get: (key: string): Promise<string | null> => ipcRenderer.invoke("settings:get", key),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke("settings:set", key, value),
    getAll: (): Promise<Record<string, string>> => ipcRenderer.invoke("settings:getAll")
  },

  notes: {
    list: (): Promise<Note[]> => ipcRenderer.invoke("notes:list"),
    create: (input: CreateNoteInput): Promise<Note> =>
      ipcRenderer.invoke("notes:create", input),
    update: (id: string, updates: UpdateNoteInput): Promise<Note | null> =>
      ipcRenderer.invoke("notes:update", id, updates),
    delete: (id: string): Promise<void> => ipcRenderer.invoke("notes:delete", id)
  },

  tasks: {
    list: (): Promise<Task[]> => ipcRenderer.invoke("tasks:list"),
    create: (input: CreateTaskInput): Promise<Task> =>
      ipcRenderer.invoke("tasks:create", input),
    update: (id: string, updates: UpdateTaskInput): Promise<Task | null> =>
      ipcRenderer.invoke("tasks:update", id, updates),
    delete: (id: string): Promise<void> => ipcRenderer.invoke("tasks:delete", id),
    setStatus: (id: string, status: TaskStatus): Promise<Task | null> =>
      ipcRenderer.invoke("tasks:setStatus", id, status)
  },

  audit: {
    list: (opts?: { limit?: number; offset?: number }): Promise<AuditLogEntry[]> =>
      ipcRenderer.invoke("audit:list", opts)
  },

  jobs: {
    list: (): Promise<Job[]> => ipcRenderer.invoke("jobs:list")
  },

  integrations: {
    list: (): Promise<Integration[]> => ipcRenderer.invoke("integrations:list"),
    listTemplates: (): Promise<ConnectorTemplate[]> =>
      ipcRenderer.invoke("integrations:listTemplates"),
    create: (input: CreateIntegrationInstanceInput): Promise<IntegrationMutationResult> =>
      ipcRenderer.invoke("integrations:create", input),
    update: (
      id: string,
      input: UpdateIntegrationInstanceInput
    ): Promise<IntegrationMutationResult> =>
      ipcRenderer.invoke("integrations:update", id, input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke("integrations:delete", id),
    test: (
      templateId: string,
      config: Record<string, unknown>,
      existingInstanceId?: string
    ): Promise<IntegrationHealth> =>
      ipcRenderer.invoke("integrations:test", templateId, config, existingInstanceId),
    connect: (id: string): Promise<IntegrationHealth> =>
      ipcRenderer.invoke("integrations:connect", id),
    disconnect: (id: string): Promise<void> =>
      ipcRenderer.invoke("integrations:disconnect", id),
    check: (id: string): Promise<IntegrationHealth> =>
      ipcRenderer.invoke("integrations:check", id),
    sync: (id: string): Promise<IntegrationHealth> =>
      ipcRenderer.invoke("integrations:sync", id),
    getSyncData: (id: string): Promise<IntegrationSyncData | null> =>
      ipcRenderer.invoke("integrations:getSyncData", id),
    listTools: (): Promise<ToolDescriptor[]> =>
      ipcRenderer.invoke("integrations:listTools"),
    callTool: (
      integrationId: string,
      toolId: string,
      input: Record<string, unknown>
    ): Promise<ToolCallResult> =>
      ipcRenderer.invoke("integrations:callTool", integrationId, toolId, input)
  },

  agents: {
    listSkills: (): Promise<SkillManifest[]> => ipcRenderer.invoke("agents:listSkills"),
    listProviders: (): Promise<{ providers: AiProviderName[]; active: AiProviderName }> =>
      ipcRenderer.invoke("agents:listProviders"),
    setProvider: (name: AiProviderName): Promise<{ active: AiProviderName }> =>
      ipcRenderer.invoke("agents:setProvider", name),
    run: (skillId: string, input: Record<string, unknown> = {}): Promise<AgentRun> =>
      ipcRenderer.invoke("agents:run", skillId, input),
    history: (limit?: number): Promise<AgentRun[]> =>
      ipcRenderer.invoke("agents:history", limit)
  },

  on: {
    paletteOpen: (listener: () => void): (() => void) => {
      const handler = () => listener();
      ipcRenderer.on("palette:open", handler);
      return () => ipcRenderer.off("palette:open", handler);
    },
    updateState: (listener: (state: UpdateState) => void): (() => void) => {
      const handler = (_event: unknown, state: UpdateState): void => listener(state);
      ipcRenderer.on("update:state", handler);
      return () => ipcRenderer.off("update:state", handler);
    }
  },

  updates: {
    getState: (): Promise<UpdateState> => ipcRenderer.invoke("updates:getState"),
    check: (userInitiated: boolean = true): Promise<UpdateState> =>
      ipcRenderer.invoke("updates:check", userInitiated),
    install: (): Promise<void> => ipcRenderer.invoke("updates:install")
  }
};

contextBridge.exposeInMainWorld("elevator", elevatorApi);

export type ElevatorApi = typeof elevatorApi;

