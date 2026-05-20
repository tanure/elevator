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

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNoteInput {
  title: string;
  content?: string;
  tags?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
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
  dueAt: Date | null;
  completedAt: Date | null;
  sourceExtension: string | null;
  sourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: Date;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
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
}

export interface AiCompletionResponse {
  text: string;
  provider: AiProviderName;
  model: string;
}

export interface SkillManifest {
  id: string;
  title: string;
  description: string;
  requiredPermissions: ExtensionPermission[];
  /** Tools the skill is allowed to call by id */
  allowedTools: string[];
}

export type AgentRunStatus = "running" | "succeeded" | "failed";

export interface AgentRun {
  id: string;
  skillId: string;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: string | null;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
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

export interface DashboardCardInstance {
  cardId: string;
  col: number;
  row: number;
  size: DashboardCardSize;
}

export interface DashboardLayout {
  id: string;
  name: string;
  isActive: boolean;
  cards: DashboardCardInstance[];
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
  "note.created": { id: string };
  "note.updated": { id: string };
  "note.deleted": { id: string };
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

