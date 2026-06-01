import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentRecord,
  AgentRun,
  AgentTool,
  AiProviderName,
  AppInfo,
  AuditLogEntry,
  BackupResult,
  ChatMessage,
  ChatSendResult,
  ChatSession,
  ChatStreamEvent,
  ConnectorTemplate,
  CopilotAuthStatus,
  CopilotDeviceLogin,
  CopilotDeviceLoginPoll,
  CopilotModel,
  CopilotStatus,
  CreateAgentInput,
  CreateChatSessionInput,
  CreateDashboardLayoutInput,
  CreateExtensionInput,
  CreateNoteInput,
  CreateNoteFolderInput,
  CreateSkillInput,
  CreateTaskInput,
  CreateTaskLabelInput,
  CreateTaskSuggestionInput,
  CreateIntegrationInstanceInput,
  CreateViewInput,
  CreateViewTemplateInput,
  DashboardLayout,
  DiagnosticsSnapshot,
  ExtensionRecord,
  Integration,
  IntegrationHealth,
  IntegrationMutationResult,
  IntegrationSyncData,
  Job,
  Note,
  NoteFolder,
  SkillManifest,
  SkillRecord,
  Task,
  TaskLabel,
  TaskStatus,
  TaskSuggestion,
  TaskSuggestionStatus,
  ToolCallResult,
  ToolDescriptor,
  UpdateAgentInput,
  UpdateChatSessionInput,
  UpdateDashboardLayoutInput,
  UpdateExtensionInput,
  UpdateIntegrationInstanceInput,
  UpdateNoteInput,
  UpdateNoteFolderInput,
  UpdateSkillInput,
  UpdateState,
  UpdateTaskInput,
  UpdateTaskLabelInput,
  UpdateViewInput,
  UpdateViewTemplateInput,
  ViewRecord,
  ViewTemplate
} from "@elevator/shared";

const elevatorApi = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:getInfo"),

  app: {
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:getInfo"),
    logRendererError: (message: string, stack: string): Promise<void> =>
      ipcRenderer.invoke("app:logRendererError", message, stack)
  },

  diagnostics: {
    snapshot: (): Promise<DiagnosticsSnapshot> => ipcRenderer.invoke("diagnostics:snapshot"),
    openLogs: (): Promise<void> => ipcRenderer.invoke("diagnostics:openLogs"),
    openDataFolder: (): Promise<void> => ipcRenderer.invoke("diagnostics:openDataFolder")
  },

  backup: {
    exportDatabase: (): Promise<BackupResult | null> =>
      ipcRenderer.invoke("backup:exportDatabase"),
    exportJson: (): Promise<BackupResult | null> =>
      ipcRenderer.invoke("backup:exportJson")
  },

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

  noteFolders: {
    list: (): Promise<NoteFolder[]> => ipcRenderer.invoke("noteFolders:list"),
    create: (input: CreateNoteFolderInput): Promise<NoteFolder> =>
      ipcRenderer.invoke("noteFolders:create", input),
    update: (id: string, updates: UpdateNoteFolderInput): Promise<NoteFolder | null> =>
      ipcRenderer.invoke("noteFolders:update", id, updates),
    delete: (id: string): Promise<void> => ipcRenderer.invoke("noteFolders:delete", id)
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

  taskLabels: {
    list: (): Promise<TaskLabel[]> => ipcRenderer.invoke("taskLabels:list"),
    create: (input: CreateTaskLabelInput): Promise<TaskLabel> =>
      ipcRenderer.invoke("taskLabels:create", input),
    update: (
      id: string,
      updates: UpdateTaskLabelInput
    ): Promise<TaskLabel | null> =>
      ipcRenderer.invoke("taskLabels:update", id, updates),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke("taskLabels:delete", id)
  },

  taskSuggestions: {
    list: (status?: TaskSuggestionStatus): Promise<TaskSuggestion[]> =>
      ipcRenderer.invoke("taskSuggestions:list", status),
    create: (input: CreateTaskSuggestionInput): Promise<TaskSuggestion> =>
      ipcRenderer.invoke("taskSuggestions:create", input),
    setStatus: (
      id: string,
      status: TaskSuggestionStatus
    ): Promise<TaskSuggestion | null> =>
      ipcRenderer.invoke("taskSuggestions:setStatus", id, status),
    accept: (id: string): Promise<Task | null> =>
      ipcRenderer.invoke("taskSuggestions:accept", id),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke("taskSuggestions:delete", id)
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
      ipcRenderer.invoke("integrations:callTool", integrationId, toolId, input),
    listContextProviders: (
      instanceId: string
    ): Promise<{ providers: ToolDescriptor[]; disabled: string[] }> =>
      ipcRenderer.invoke("integrations:listContextProviders", instanceId),
    setContextProviderEnabled: (
      instanceId: string,
      providerId: string,
      enabled: boolean
    ): Promise<void> =>
      ipcRenderer.invoke(
        "integrations:setContextProviderEnabled",
        instanceId,
        providerId,
        enabled
      )
  },

  skills: {
    list: (): Promise<SkillRecord[]> => ipcRenderer.invoke("skills:list"),
    get: (id: string): Promise<SkillRecord | null> =>
      ipcRenderer.invoke("skills:get", id),
    create: (input: CreateSkillInput): Promise<SkillRecord> =>
      ipcRenderer.invoke("skills:create", input),
    update: (id: string, input: UpdateSkillInput): Promise<SkillRecord | null> =>
      ipcRenderer.invoke("skills:update", id, input),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke("skills:delete", id),
    run: (skillId: string, input: Record<string, unknown> = {}): Promise<AgentRun> =>
      ipcRenderer.invoke("skills:run", skillId, input)
  },

  agents: {
    // Skills (legacy alias kept so older callers keep working)
    listSkills: (): Promise<SkillManifest[]> => ipcRenderer.invoke("agents:listSkills"),

    // Providers (will move to settings.ai in 9F)
    listProviders: (): Promise<{ providers: AiProviderName[]; active: AiProviderName }> =>
      ipcRenderer.invoke("agents:listProviders"),
    setProvider: (name: AiProviderName): Promise<{ active: AiProviderName }> =>
      ipcRenderer.invoke("agents:setProvider", name),

    // Agents CRUD
    list: (): Promise<AgentRecord[]> => ipcRenderer.invoke("agents:list"),
    get: (id: string): Promise<AgentRecord | null> =>
      ipcRenderer.invoke("agents:get", id),
    create: (input: CreateAgentInput): Promise<AgentRecord> =>
      ipcRenderer.invoke("agents:create", input),
    update: (id: string, input: UpdateAgentInput): Promise<AgentRecord | null> =>
      ipcRenderer.invoke("agents:update", id, input),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke("agents:delete", id),

    // Runs
    run: (skillId: string, input: Record<string, unknown> = {}): Promise<AgentRun> =>
      ipcRenderer.invoke("agents:run", skillId, input),
    runSkill: (
      agentId: string,
      skillId: string,
      input: Record<string, unknown> = {}
    ): Promise<AgentRun> => ipcRenderer.invoke("agents:runSkill", agentId, skillId, input),
    listAvailableTools: (): Promise<AgentTool[]> =>
      ipcRenderer.invoke("agents:listAvailableTools"),
    history: (limit?: number): Promise<AgentRun[]> =>
      ipcRenderer.invoke("agents:history", limit)
  },

  chat: {
    listSessions: (): Promise<ChatSession[]> =>
      ipcRenderer.invoke("chat:listSessions"),
    getSession: (id: string): Promise<ChatSession | null> =>
      ipcRenderer.invoke("chat:getSession", id),
    createSession: (input: CreateChatSessionInput = {}): Promise<ChatSession> =>
      ipcRenderer.invoke("chat:createSession", input),
    updateSession: (
      id: string,
      input: UpdateChatSessionInput
    ): Promise<ChatSession | null> => ipcRenderer.invoke("chat:updateSession", id, input),
    deleteSession: (id: string): Promise<void> =>
      ipcRenderer.invoke("chat:deleteSession", id),
    listMessages: (sessionId: string): Promise<ChatMessage[]> =>
      ipcRenderer.invoke("chat:listMessages", sessionId),
    send: (
      sessionId: string,
      content: string,
      contextPayload?: unknown
    ): Promise<ChatSendResult> =>
      ipcRenderer.invoke("chat:send", sessionId, content, contextPayload),
    listAvailableTools: (): Promise<AgentTool[]> =>
      ipcRenderer.invoke("chat:listAvailableTools"),
    onStream: (listener: (event: ChatStreamEvent) => void): (() => void) => {
      const handler = (_e: unknown, event: ChatStreamEvent): void => listener(event);
      ipcRenderer.on("chat:stream", handler);
      return () => ipcRenderer.off("chat:stream", handler);
    }
  },

  copilot: {
    getStatus: (): Promise<CopilotStatus> => ipcRenderer.invoke("copilot:getStatus"),
    setToken: (token: string): Promise<void> =>
      ipcRenderer.invoke("copilot:setToken", token),
    clearToken: (): Promise<void> => ipcRenderer.invoke("copilot:clearToken"),
    setModel: (model: string): Promise<void> =>
      ipcRenderer.invoke("copilot:setModel", model),
    setEndpoint: (endpoint: string): Promise<void> =>
      ipcRenderer.invoke("copilot:setEndpoint", endpoint),
    getAuthStatus: (): Promise<CopilotAuthStatus> =>
      ipcRenderer.invoke("copilot:getAuthStatus"),
    listModels: (): Promise<CopilotModel[]> =>
      ipcRenderer.invoke("copilot:listModels"),
    startDeviceLogin: (): Promise<CopilotDeviceLogin> =>
      ipcRenderer.invoke("copilot:startDeviceLogin"),
    pollDeviceLogin: (deviceCode: string): Promise<CopilotDeviceLoginPoll> =>
      ipcRenderer.invoke("copilot:pollDeviceLogin", deviceCode)
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
  },

  dashboardLayouts: {
    list: (): Promise<DashboardLayout[]> => ipcRenderer.invoke("dashboardLayouts:list"),
    get: (id: string): Promise<DashboardLayout | null> =>
      ipcRenderer.invoke("dashboardLayouts:get", id),
    getActive: (viewId: string | null = null): Promise<DashboardLayout | null> =>
      ipcRenderer.invoke("dashboardLayouts:getActive", viewId),
    create: (input: CreateDashboardLayoutInput): Promise<DashboardLayout> =>
      ipcRenderer.invoke("dashboardLayouts:create", input),
    update: (
      id: string,
      input: UpdateDashboardLayoutInput
    ): Promise<DashboardLayout | null> =>
      ipcRenderer.invoke("dashboardLayouts:update", id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke("dashboardLayouts:delete", id)
  },

  extensions: {
    list: (): Promise<ExtensionRecord[]> => ipcRenderer.invoke("extensions:list"),
    get: (id: string): Promise<ExtensionRecord | null> =>
      ipcRenderer.invoke("extensions:get", id),
    create: (input: CreateExtensionInput): Promise<ExtensionRecord> =>
      ipcRenderer.invoke("extensions:create", input),
    update: (
      id: string,
      input: UpdateExtensionInput
    ): Promise<ExtensionRecord | null> =>
      ipcRenderer.invoke("extensions:update", id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke("extensions:delete", id),
    latestRun: (agentId: string): Promise<AgentRun | null> =>
      ipcRenderer.invoke("extensions:latestRun", agentId)
  },

  views: {
    list: (): Promise<ViewRecord[]> => ipcRenderer.invoke("views:list"),
    get: (id: string): Promise<ViewRecord | null> =>
      ipcRenderer.invoke("views:get", id),
    create: (input: CreateViewInput): Promise<ViewRecord> =>
      ipcRenderer.invoke("views:create", input),
    update: (id: string, input: UpdateViewInput): Promise<ViewRecord | null> =>
      ipcRenderer.invoke("views:update", id, input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke("views:delete", id),
    createFromTemplate: (
      templateId: string,
      input: { name: string; parameters: Record<string, unknown>; groupName?: string }
    ): Promise<ViewRecord> =>
      ipcRenderer.invoke("views:createFromTemplate", templateId, input)
  },

  viewTemplates: {
    list: (): Promise<ViewTemplate[]> => ipcRenderer.invoke("viewTemplates:list"),
    get: (id: string): Promise<ViewTemplate | null> =>
      ipcRenderer.invoke("viewTemplates:get", id),
    create: (input: CreateViewTemplateInput): Promise<ViewTemplate> =>
      ipcRenderer.invoke("viewTemplates:create", input),
    update: (
      id: string,
      input: UpdateViewTemplateInput
    ): Promise<ViewTemplate | null> =>
      ipcRenderer.invoke("viewTemplates:update", id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke("viewTemplates:delete", id),
    createFromView: (
      viewId: string,
      input: { name: string; description?: string }
    ): Promise<ViewTemplate> =>
      ipcRenderer.invoke("viewTemplates:createFromView", viewId, input)
  }
};

contextBridge.exposeInMainWorld("elevator", elevatorApi);

export type ElevatorApi = typeof elevatorApi;

