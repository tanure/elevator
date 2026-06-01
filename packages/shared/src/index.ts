export type ExtensionPermission =
  | "dashboard:read"
  | "dashboard:write"
  | "routine:run"
  | "tool:execute"
  | "integration:connect";

export type DashboardCardKind =
  | "summary"
  | "list"
  | "task-list"
  | "metric"
  | "link"
  | "timeline"
  | "alert"
  | "agent-recommendation";

export type DashboardCardSize = "small" | "medium" | "large" | "wide";

export interface DashboardCardManifest {
  id: string;
  title: string;
  kind: DashboardCardKind;
  defaultSize: DashboardCardSize;
  requiredPermissions: ExtensionPermission[];
  refreshPolicy: "manual" | "on-startup" | "scheduled";
}

export interface RoutineManifest {
  id: string;
  title: string;
  trigger: "manual" | "on-startup" | "scheduled";
  schedule?: string;
  requiredPermissions: ExtensionPermission[];
}

export interface ExtensionManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  permissions: ExtensionPermission[];
  cards: DashboardCardManifest[];
  routines: RoutineManifest[];
}

export interface AppInfo {
  name: string;
  version: string;
}

// ── Notes ────────────────────────────────────────────────────────────────────

/**
 * BlockNote document content stored as a JSON array of block descriptors.
 * Kept loose at the shared layer to avoid coupling to the editor library.
 */
export type NoteContentJson = unknown[];

export interface Note {
  id: string;
  title: string;
  contentJson: NoteContentJson;
  tags: string[];
  folderId: string | null;
  isPinned: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNoteInput {
  title: string;
  contentJson?: NoteContentJson;
  tags?: string[];
  folderId?: string | null;
}

export interface UpdateNoteInput {
  title?: string;
  contentJson?: NoteContentJson;
  tags?: string[];
  folderId?: string | null;
  isPinned?: boolean;
}

export interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNoteFolderInput {
  name: string;
  parentId?: string | null;
}

export interface UpdateNoteFolderInput {
  name?: string;
  parentId?: string | null;
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus = "todo" | "in-progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startAt: Date | null;
  dueAt: Date | null;
  completedAt: Date | null;
  sourceExtension: string | null;
  sourceId: string | null;
  metadata: Record<string, unknown>;
  labelIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  startAt?: Date | null;
  dueAt?: Date | null;
  labelIds?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  startAt?: Date | null;
  dueAt?: Date | null;
  labelIds?: string[];
}

// ── Task labels ──────────────────────────────────────────────────────────────

export interface TaskLabel {
  id: string;
  name: string;
  /** CSS color (e.g. "#3b82f6" or a Tailwind-safe token). */
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskLabelInput {
  name: string;
  color: string;
}

export interface UpdateTaskLabelInput {
  name?: string;
  color?: string;
}

// ── Task suggestions ─────────────────────────────────────────────────────────

export type TaskSuggestionStatus = "pending" | "accepted" | "dismissed";

export interface TaskSuggestion {
  id: string;
  agentId: string | null;
  agentRunId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueAt: Date | null;
  status: TaskSuggestionStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface CreateTaskSuggestionInput {
  agentId?: string | null;
  agentRunId?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: Date | null;
}

// ── Integrations ─────────────────────────────────────────────────────────────

export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";
export type IntegrationType = "api" | "mcp" | "cli";

/**
 * Authentication style a connector template uses. Drives the UI helper text
 * and which field types render. `oauth` templates trigger the OAuth helper
 * during connect instead of relying purely on user-entered fields.
 */
export type ConnectorAuthStyle = "none" | "api-key" | "basic" | "oauth" | "file-path";

/**
 * A single field in a connector template's configuration schema.
 *
 * Secrets are stored separately (Electron `safeStorage`/keytar) and never
 * persisted in the integrations table. The repository replaces secret values
 * with an opaque `{ secretRef: true }` marker before persisting.
 */
export type ConfigFieldType =
  | "string"
  | "multiline"
  | "secret"
  | "number"
  | "boolean"
  | "select"
  | "path"
  | "url";

export interface ConfigFieldDescriptor {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** For `select` fields */
  options?: Array<{ value: string; label: string }>;
  /** Optional regex (string) validated server-side and in the renderer */
  pattern?: string;
  patternMessage?: string;
  /** Numeric bounds for `number` */
  min?: number;
  max?: number;
  /** Default value applied when the user creates a new instance */
  defaultValue?: string | number | boolean;
}

export type ConnectorConfigSchema = ConfigFieldDescriptor[];

/**
 * Metadata describing a class of connector users can instantiate. A template
 * is a static factory; an `Integration` row in the database is one named
 * instance built from a template.
 */
export interface ConnectorTemplate {
  id: string;
  name: string;
  description: string;
  type: IntegrationType;
  authStyle: ConnectorAuthStyle;
  supportsMultipleInstances: boolean;
  /** Lucide icon name; defaults handled by the renderer */
  icon?: string;
  configSchema: ConnectorConfigSchema;
  /** Permissions the user must consent to before the template is instantiated */
  requiredPermissions: ExtensionPermission[];
  /** Optional human-readable hostnames the connector will reach out to */
  networkTargets?: string[];
}

/**
 * Marker stored in the persisted config in place of secret field values. The
 * actual secret material lives in the OS credential vault, keyed by
 * `${instanceId}:${fieldKey}`.
 */
export interface SecretRef {
  secretRef: true;
}

export interface Integration {
  id: string;
  /** Template the instance was created from. Optional for legacy/built-in rows. */
  templateId: string | null;
  /** Connector implementation id (e.g. `cli`, `workiq`). */
  name: string;
  /** User-chosen friendly name shown in the UI. */
  displayName: string;
  type: IntegrationType;
  status: IntegrationStatus;
  /** Non-secret config plus `secretRef` markers for secret fields. */
  config: Record<string, unknown>;
  lastCheckedAt: Date | null;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  syncIntervalSec: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationHealth {
  ok: boolean;
  message: string;
  checkedAt: Date;
}

/** Field-level validation failure surfaced from the main process. */
export interface ConfigValidationError {
  field: string;
  message: string;
}

export interface CreateIntegrationInstanceInput {
  templateId: string;
  displayName: string;
  config: Record<string, unknown>;
  syncIntervalSec?: number | null;
}

export interface UpdateIntegrationInstanceInput {
  displayName?: string;
  config?: Record<string, unknown>;
  syncIntervalSec?: number | null;
}

export interface IntegrationMutationResult {
  ok: boolean;
  integration?: Integration;
  errors?: ConfigValidationError[];
  message?: string;
}

export interface ToolDescriptor {
  id: string;
  integrationId: string;
  name: string;
  description: string;
  /** OWASP-conscious permission gate for the tool */
  requiredPermissions: ExtensionPermission[];
  /** JSON-schema-like description of the input shape */
  inputSchema: Record<string, unknown>;
  /**
   * Distinguishes regular invocable tools from passive "context providers"
   * the user can toggle per integration. Defaults to "tool".
   */
  kind?: "tool" | "context";
}

export interface ToolCallResult {
  ok: boolean;
  output: unknown;
  error?: string;
}

// ── Integration sync payloads ────────────────────────────────────────────────

/**
 * Shared payload shape connectors emit on `sync()` and the renderer reads via
 * `integrations.getSyncData`. The `kind` discriminator lets dashboard cards
 * filter integrations by the data domain they contribute to (calendar/mail/
 * report) without hard-coding template ids.
 */
export type IntegrationSyncKind = "calendar" | "mail" | "report" | "custom";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO timestamp
  end: string; // ISO timestamp
  allDay?: boolean;
  location?: string;
  url?: string;
  organizer?: string;
}

export interface MailMessage {
  id: string;
  subject: string;
  from: string;
  receivedAt: string; // ISO timestamp
  preview: string;
  unread?: boolean;
  webLink?: string;
}

export interface ReportSnapshot {
  title: string;
  /** Free-form headline metric (e.g. "37 open issues") */
  headline?: string;
  rows?: Array<{ label: string; value: string }>;
  url?: string;
  fetchedAt: string;
}

export interface IntegrationSyncData {
  integrationId: string;
  kind: IntegrationSyncKind;
  fetchedAt: string;
  events?: CalendarEvent[];
  mail?: MailMessage[];
  report?: ReportSnapshot;
  raw?: unknown;
}

// ── OAuth helper ─────────────────────────────────────────────────────────────

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string; // ISO timestamp
  scope?: string;
  tokenType?: string;
}

// ── AI & agents ──────────────────────────────────────────────────────────────

export type AiProviderName = "echo" | "copilot";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionRequest {
  messages: AiMessage[];
  /** Optional model identifier; provider decides the default */
  model?: string;
  /** Tools the provider is allowed to call. Providers that don't support
   *  tool calling (e.g. echo) should ignore this and return plain text. */
  tools?: AgentTool[];
}

export interface AiToolCallRequest {
  toolId: string;
  input: Record<string, unknown>;
}

export interface AiCompletionResponse {
  text: string;
  provider: AiProviderName;
  model: string;
  /** When present, the runner should dispatch each call, append the result
   *  as a tool-result message, and re-invoke `complete`. */
  toolCalls?: AiToolCallRequest[];
}

/** A single delta emitted by a streaming provider. */
export interface AiStreamChunk {
  delta: string;
}

/** Event broadcast to renderers during a streamed chat turn. */
export interface ChatStreamEvent {
  sessionId: string;
  /** Cumulative text accumulated so far. */
  text: string;
  /** New delta appended on this event (empty on "end"). */
  delta: string;
  kind: "chunk" | "end" | "error";
  error?: string;
}

/** Status of the Copilot/BYOM token configured in the app. */
export interface CopilotStatus {
  configured: boolean;
  encryptionAvailable: boolean;
  model: string;
  endpoint: string;
}

/** Auth state reported by the Copilot CLI / SDK. */
export interface CopilotAuthStatus {
  isAuthenticated: boolean;
  authType?: "user" | "env" | "gh-cli" | "hmac" | "api-key" | "token";
  host?: string;
  login?: string;
  statusMessage?: string;
}

/** Slimmed-down model descriptor surfaced to the renderer. */
export interface CopilotModel {
  id: string;
  name: string;
  /** "enabled" | "disabled" | "unconfigured" */
  policy?: string;
  /** Token cost multiplier reported by the API, if any. */
  multiplier?: number;
  maxContextWindowTokens?: number;
  supportsVision?: boolean;
}

/**
 * GitHub OAuth device-flow handshake response. Surfaced to the renderer so
 * the user can complete sign-in in their browser without installing gh CLI.
 */
export interface CopilotDeviceLogin {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** Polling interval in seconds suggested by GitHub. */
  interval: number;
  /** Total lifetime of the device code in seconds. */
  expiresIn: number;
}

/** Result of a single device-flow poll attempt. */
export interface CopilotDeviceLoginPoll {
  status:
    | "pending"
    | "slow_down"
    | "success"
    | "expired"
    | "denied"
    | "error";
  /** When status === "slow_down", the renderer should bump its interval. */
  interval?: number;
  /** When status === "error", a human-readable description. */
  error?: string;
  /** Copilot-authenticated user login, populated when status === "success". */
  login?: string;
}

export interface SkillManifest {
  id: string;
  title: string;
  description: string;
  requiredPermissions: ExtensionPermission[];
  /** Tools the skill is allowed to call by id */
  allowedTools: string[];
}

// ── Skills and Agents (user-authored, M9) ────────────────────────────────────

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  /** Prompt body with `{{variable}}` placeholders replaced at run time */
  promptTemplate: string;
  /** Variable names the user can fill in when running the skill */
  inputVariables: string[];
  /** Fully-qualified tool ids (`instanceName.toolId`) the skill may call */
  allowedTools: string[];
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  systemPrompt?: string;
  promptTemplate?: string;
  inputVariables?: string[];
  allowedTools?: string[];
  isBuiltIn?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
  promptTemplate?: string;
  inputVariables?: string[];
  allowedTools?: string[];
}

/**
 * Schedule on which an agent's `agent.tick` job re-fires. `none` disables
 * scheduling. `every-minutes` re-fires every N minutes from now.
 * `daily` re-fires at a fixed local time of day.
 */
export type AgentSchedule =
  | { kind: "none" }
  | { kind: "every-minutes"; minutes: number }
  | { kind: "daily"; hour: number; minute: number };

export interface AgentRecord {
  id: string;
  name: string;
  description: string;
  provider: AiProviderName;
  model: string | null;
  skillIds: string[];
  /** Tool ids the agent is allowed to call. Format `instance.toolId`. */
  allowedTools: string[];
  /** Persistent identity + behaviour rules merged into every turn. */
  systemPrompt: string;
  /** Standing objective used by scheduled ticks as the user prompt. */
  goal: string;
  /** When and how the agent fires on its own. */
  schedule: AgentSchedule;
  maxToolCalls: number;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  provider: AiProviderName;
  model?: string | null;
  skillIds: string[];
  allowedTools?: string[];
  systemPrompt?: string;
  goal?: string;
  schedule?: AgentSchedule;
  maxToolCalls?: number;
  isBuiltIn?: boolean;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  provider?: AiProviderName;
  model?: string | null;
  skillIds?: string[];
  allowedTools?: string[];
  systemPrompt?: string;
  goal?: string;
  schedule?: AgentSchedule;
  maxToolCalls?: number;
}

/** Tool exposed to a skill, materialised from a connected integration instance. */
export interface AgentTool {
  /** Fully-qualified id: `${instanceName}.${toolId}` */
  id: string;
  /** Source integration instance id (for dispatch) */
  instanceId: string;
  /** Source instance display name (for grouping in pickers) */
  instanceName: string;
  /** Tool id within the connector */
  toolId: string;
  title: string;
  description: string;
  /** "context" when sourced from a connector's context provider list. */
  kind?: "tool" | "context";
}

export interface AgentToolCall {
  toolId: string;
  input: Record<string, unknown>;
  output: unknown;
  ok: boolean;
  error: string | null;
  startedAt: string;
  completedAt: string;
}

export type AgentRunStatus = "running" | "succeeded" | "failed";

export interface AgentRun {
  id: string;
  skillId: string;
  agentId: string | null;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: string | null;
  error: string | null;
  toolCalls: AgentToolCall[];
  startedAt: Date;
  completedAt: Date | null;
}

// ── Chat (M10) ───────────────────────────────────────────────────────────────

export type ChatMessageRole = "system" | "user" | "assistant";

export interface ChatSession {
  id: string;
  title: string;
  provider: AiProviderName;
  model: string | null;
  systemPrompt: string;
  /** Tool ids this session is permitted to call. Format: `instance.toolId`. */
  allowedTools: string[];
  /** Cap on tool-call iterations per turn. */
  maxToolCalls: number;
  /**
   * Optional agent backing this session. When set, the agent's systemPrompt
   * and goal are prepended to the session's systemPrompt on every turn.
   * All other settings (provider/model/allowedTools/maxToolCalls) remain
   * session-owned so a user can fork an agent for a single conversation.
   */
  agentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  /** Provider that produced the message (assistant only). */
  provider: AiProviderName | null;
  model: string | null;
  /** Tool calls executed while producing this message (assistant only). */
  toolCalls: AgentToolCall[];
  createdAt: Date;
}

export interface CreateChatSessionInput {
  title?: string;
  provider?: AiProviderName;
  model?: string | null;
  systemPrompt?: string;
  allowedTools?: string[];
  maxToolCalls?: number;
  agentId?: string | null;
}

export interface UpdateChatSessionInput {
  title?: string;
  provider?: AiProviderName;
  model?: string | null;
  systemPrompt?: string;
  allowedTools?: string[];
  maxToolCalls?: number;
  agentId?: string | null;
}

export interface ChatSendResult {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

// ── Audit log ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  timestamp: Date;
  actor: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  error: string | null;
  retries: number;
  maxRetries: number;
  createdAt: Date;
}

// ── Dashboard layout ──────────────────────────────────────────────────────────

/**
 * A single positioned card inside a dashboard layout. `cardId` can be a
 * built-in card id (registered statically) or `extension:<extensionId>` for
 * an extension-driven card.
 */
export interface DashboardSlot {
  cardId: string;
  colSpan?: 1 | 2;
}

/** Legacy positioned-card type kept for backwards compat with M8 code paths. */
export interface DashboardCardInstance {
  cardId: string;
  col: number;
  row: number;
  size: DashboardCardSize;
}

export interface DashboardLayout {
  id: string;
  name: string;
  /** When non-null, this layout belongs to a specific view. */
  viewId: string | null;
  isActive: boolean;
  slots: DashboardSlot[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDashboardLayoutInput {
  name: string;
  viewId?: string | null;
  slots?: DashboardSlot[];
  isActive?: boolean;
}

export interface UpdateDashboardLayoutInput {
  name?: string;
  slots?: DashboardSlot[];
  isActive?: boolean;
}

// ── Extensions (dynamic dashboard cards) ─────────────────────────────────────

/**
 * A user-installed extension that contributes a dashboard card. The card
 * renders the latest output of the referenced agent (or skill) as markdown.
 *
 * `refreshSchedule` is informational metadata; the runtime relies on the
 * underlying agent's own schedule for actually producing fresh runs.
 */
export interface ExtensionRecord {
  id: string;
  title: string;
  description: string;
  /** Currently only "card" is supported. Reserved for future expansion. */
  kind: "card";
  /** Reference to an agent whose latest run output drives the card body. */
  agentId: string | null;
  /** Optional skill id used when agentId is not set. */
  skillId: string | null;
  /** Free-form human-readable schedule (e.g. "every 15m"). Informational only. */
  refreshSchedule: string;
  /** Display hints — e.g. preferred column span. */
  renderHints: { colSpan?: 1 | 2 };
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExtensionInput {
  title: string;
  description?: string;
  agentId?: string | null;
  skillId?: string | null;
  refreshSchedule?: string;
  renderHints?: { colSpan?: 1 | 2 };
  isEnabled?: boolean;
}

export interface UpdateExtensionInput {
  title?: string;
  description?: string;
  agentId?: string | null;
  skillId?: string | null;
  refreshSchedule?: string;
  renderHints?: { colSpan?: 1 | 2 };
  isEnabled?: boolean;
}

// ── Views (customer workspaces) ──────────────────────────────────────────────

/**
 * A user-defined workspace with its own layout, chat session, and optional
 * parameters (template variables). Views are rendered as routes
 * `/views/:id` and grouped in the sidebar by `groupName`.
 */
export interface ViewRecord {
  id: string;
  groupName: string;
  name: string;
  /** lucide-react icon name. */
  icon: string;
  layoutId: string | null;
  defaultChatSessionId: string | null;
  agentIds: string[];
  /** Arbitrary template parameters (e.g. customerName). */
  parameters: Record<string, unknown>;
  /** Set when the view was created from a template. */
  templateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateViewInput {
  groupName: string;
  name: string;
  icon?: string;
  layoutId?: string | null;
  defaultChatSessionId?: string | null;
  agentIds?: string[];
  parameters?: Record<string, unknown>;
  templateId?: string | null;
}

export interface UpdateViewInput {
  groupName?: string;
  name?: string;
  icon?: string;
  layoutId?: string | null;
  defaultChatSessionId?: string | null;
  agentIds?: string[];
  parameters?: Record<string, unknown>;
}

/**
 * Re-usable view recipe. `body` is the parameter-substitutable description:
 * default layout, parameter schema, default agent/skill refs.
 */
export interface ViewTemplate {
  id: string;
  name: string;
  description: string;
  body: ViewTemplateBody;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewTemplateBody {
  groupName: string;
  /** Slots cloned into the new view's layout. */
  slots: DashboardSlot[];
  /** Parameter schema: name → human-readable label and optional default. */
  parameters: ViewTemplateParameter[];
  /** Agents to attach to the new view. */
  agentIds?: string[];
  /** Default sidebar icon. */
  icon?: string;
}

export interface ViewTemplateParameter {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
}

export interface CreateViewTemplateInput {
  name: string;
  description?: string;
  body: ViewTemplateBody;
  isBuiltIn?: boolean;
}

export interface UpdateViewTemplateInput {
  name?: string;
  description?: string;
  body?: ViewTemplateBody;
}

// ── Updates ──────────────────────────────────────────────────────────────────

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  releaseNotes: string | null;
  releaseDate: string | null;
  progress: UpdateProgress | null;
  error: string | null;
  lastCheckedAt: string | null;
}

// ── Events ───────────────────────────────────────────────────────────────────

export interface AppEventMap {
  "settings.changed": { key: string; value: unknown };
  "task.created": { id: string };
  "task.updated": { id: string };
  "task.deleted": { id: string };
  "task.label.created": { id: string };
  "task.label.updated": { id: string };
  "task.label.deleted": { id: string };
  "task.suggestion.created": { id: string };
  "task.suggestion.resolved": { id: string; status: TaskSuggestionStatus };
  "note.created": { id: string };
  "note.updated": { id: string };
  "note.deleted": { id: string };
  "note.folder.created": { id: string };
  "note.folder.updated": { id: string };
  "note.folder.deleted": { id: string };
  "job.completed": { id: string; type: string };
  "job.failed": { id: string; type: string; error: string };
  "routine.completed": { id: string };
  "agent.completed": { id: string };
  "agent.failed": { id: string; error: string };
  "integration.connected": { id: string };
  "integration.disconnected": { id: string };
  "integration.created": { id: string };
  "integration.updated": { id: string };
  "integration.deleted": { id: string };
  "integration.synced": { id: string; ok: boolean };
  "dashboard.layout.updated": { id: string };
  "extension.created": { id: string };
  "extension.updated": { id: string };
  "extension.deleted": { id: string };
  "view.created": { id: string };
  "view.updated": { id: string };
  "view.deleted": { id: string };
  "view.template.created": { id: string };
  "view.template.updated": { id: string };
  "view.template.deleted": { id: string };
  "update.available": { version: string };
  "update.state": UpdateState;
}


// -- Diagnostics & backup (M8) -----------------------------------------------

export interface DiagnosticsSnapshot {
  app: { name: string; version: string; packaged: boolean };
  os: { platform: string; release: string; arch: string };
  electron: { electron: string; chrome: string; node: string };
  paths: { userData: string; dbPath: string; logsPath: string };
  db: { sizeBytes: number | null; lastModified: string | null };
  integrations: { id: string; templateId: string; name: string; status: string; lastSyncedAt: string | null }[];
  scheduler: { pendingJobs: number; runningJobs: number; failedJobs: number };
  capturedAt: string;
}

export interface BackupResult {
  filePath: string;
  bytes: number;
}

