import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  contentJson: text("content_json").notNull().default("[]"),
  tags: text("tags").notNull().default("[]"),
  folderId: text("folder_id"),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const noteFolders = sqliteTable("note_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["todo", "in-progress", "done", "cancelled"]
  })
    .notNull()
    .default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
    .notNull()
    .default("medium"),
  startAt: integer("start_at", { mode: "timestamp_ms" }),
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  sourceExtension: text("source_extension"),
  sourceId: text("source_id"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const taskLabels = sqliteTable("task_labels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const taskTaskLabels = sqliteTable("task_task_labels", {
  taskId: text("task_id").notNull(),
  labelId: text("label_id").notNull()
});

export const taskSuggestions = sqliteTable("task_suggestions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id"),
  agentRunId: text("agent_run_id"),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
    .notNull()
    .default("medium"),
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["pending", "accepted", "dismissed"] })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" })
});

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  templateId: text("template_id"),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  type: text("type", { enum: ["api", "mcp", "cli"] }).notNull(),
  status: text("status", {
    enum: ["connected", "disconnected", "error", "pending"]
  })
    .notNull()
    .default("disconnected"),
  config: text("config").notNull().default("{}"),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),
  lastSyncError: text("last_sync_error"),
  syncIntervalSec: integer("sync_interval_sec"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  metadata: text("metadata").notNull().default("{}")
});

export const dashboardLayouts = sqliteTable("dashboard_layouts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  viewId: text("view_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  layout: text("layout").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const extensions = sqliteTable("extensions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind", { enum: ["card"] }).notNull().default("card"),
  agentId: text("agent_id"),
  skillId: text("skill_id"),
  refreshSchedule: text("refresh_schedule").notNull().default(""),
  renderHints: text("render_hints").notNull().default("{}"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const views = sqliteTable("views", {
  id: text("id").primaryKey(),
  groupName: text("group_name").notNull(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("Folder"),
  layoutId: text("layout_id"),
  defaultChatSessionId: text("default_chat_session_id"),
  agentIds: text("agent_ids").notNull().default("[]"),
  parameters: text("parameters").notNull().default("{}"),
  templateId: text("template_id"),
  chatInstructions: text("chat_instructions").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const viewTemplates = sqliteTable("view_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  body: text("body").notNull().default("{}"),
  isBuiltIn: integer("is_built_in", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const jobQueue = sqliteTable("job_queue", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: text("payload").notNull().default("{}"),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"]
  })
    .notNull()
    .default("pending"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  failedAt: integer("failed_at", { mode: "timestamp_ms" }),
  error: text("error"),
  retries: integer("retries").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull(),
  agentId: text("agent_id"),
  status: text("status", { enum: ["running", "succeeded", "failed"] })
    .notNull()
    .default("running"),
  input: text("input").notNull().default("{}"),
  output: text("output"),
  error: text("error"),
  toolCalls: text("tool_calls").notNull().default("[]"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" })
});

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  systemPrompt: text("system_prompt").notNull().default(""),
  promptTemplate: text("prompt_template").notNull().default(""),
  inputVariables: text("input_variables").notNull().default("[]"),
  allowedTools: text("allowed_tools").notNull().default("[]"),
  isBuiltIn: integer("is_built_in", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  provider: text("provider").notNull().default("echo"),
  model: text("model"),
  skillIds: text("skill_ids").notNull().default("[]"),
  allowedTools: text("allowed_tools").notNull().default("[]"),
  systemPrompt: text("system_prompt").notNull().default(""),
  goal: text("goal").notNull().default(""),
  schedule: text("schedule").notNull().default('{"kind":"none"}'),
  maxToolCalls: integer("max_tool_calls").notNull().default(5),
  isBuiltIn: integer("is_built_in", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const promptTemplates = sqliteTable("prompt_templates", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("New chat"),
  provider: text("provider").notNull().default("echo"),
  model: text("model"),
  systemPrompt: text("system_prompt").notNull().default(""),
  allowedTools: text("allowed_tools").notNull().default("[]"),
  maxToolCalls: integer("max_tool_calls").notNull().default(5),
  agentId: text("agent_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role", { enum: ["system", "user", "assistant"] }).notNull(),
  content: text("content").notNull().default(""),
  provider: text("provider"),
  model: text("model"),
  toolCalls: text("tool_calls"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});
