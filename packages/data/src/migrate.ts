import type { Client } from "@libsql/client";

interface Migration {
  version: number;
  name: string;
  up: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: `
      CREATE TABLE IF NOT EXISTS settings (
        key        TEXT    PRIMARY KEY,
        value      TEXT    NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id          TEXT    PRIMARY KEY,
        title       TEXT    NOT NULL,
        content     TEXT    NOT NULL DEFAULT '',
        tags        TEXT    NOT NULL DEFAULT '[]',
        is_pinned   INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id               TEXT    PRIMARY KEY,
        title            TEXT    NOT NULL,
        description      TEXT,
        status           TEXT    NOT NULL DEFAULT 'todo',
        priority         TEXT    NOT NULL DEFAULT 'medium',
        due_at           INTEGER,
        completed_at     INTEGER,
        source_extension TEXT,
        source_id        TEXT,
        metadata         TEXT    NOT NULL DEFAULT '{}',
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS integrations (
        id              TEXT    PRIMARY KEY,
        name            TEXT    NOT NULL,
        type            TEXT    NOT NULL,
        status          TEXT    NOT NULL DEFAULT 'disconnected',
        config          TEXT    NOT NULL DEFAULT '{}',
        last_checked_at INTEGER,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        actor     TEXT    NOT NULL,
        action    TEXT    NOT NULL,
        target    TEXT,
        metadata  TEXT    NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS dashboard_layouts (
        id         TEXT    PRIMARY KEY,
        name       TEXT    NOT NULL,
        is_active  INTEGER NOT NULL DEFAULT 0,
        layout     TEXT    NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_queue (
        id           TEXT    PRIMARY KEY,
        type         TEXT    NOT NULL,
        payload      TEXT    NOT NULL DEFAULT '{}',
        status       TEXT    NOT NULL DEFAULT 'pending',
        scheduled_at INTEGER NOT NULL,
        started_at   INTEGER,
        completed_at INTEGER,
        failed_at    INTEGER,
        error        TEXT,
        retries      INTEGER NOT NULL DEFAULT 0,
        max_retries  INTEGER NOT NULL DEFAULT 3,
        created_at   INTEGER NOT NULL
      );
    `
  },
  {
    version: 2,
    name: "agent_runtime",
    up: `
      CREATE TABLE IF NOT EXISTS agent_runs (
        id           TEXT    PRIMARY KEY,
        skill_id     TEXT    NOT NULL,
        status       TEXT    NOT NULL DEFAULT 'running',
        input        TEXT    NOT NULL DEFAULT '{}',
        output       TEXT,
        error        TEXT,
        started_at   INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS prompt_templates (
        id         TEXT    PRIMARY KEY,
        title      TEXT    NOT NULL,
        body       TEXT    NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `
  },
  {
    version: 3,
    name: "integration_instances",
    up: `
      ALTER TABLE integrations ADD COLUMN template_id TEXT;
      ALTER TABLE integrations ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE integrations ADD COLUMN last_sync_at INTEGER;
      ALTER TABLE integrations ADD COLUMN last_sync_error TEXT;
      ALTER TABLE integrations ADD COLUMN sync_interval_sec INTEGER;
      UPDATE integrations SET display_name = name WHERE display_name = '';
    `
  },
  {
    version: 4,
    name: "skills_and_agents",
    up: `
      ALTER TABLE agent_runs ADD COLUMN agent_id TEXT;
      ALTER TABLE agent_runs ADD COLUMN tool_calls TEXT NOT NULL DEFAULT '[]';

      CREATE TABLE IF NOT EXISTS skills (
        id              TEXT    PRIMARY KEY,
        name            TEXT    NOT NULL,
        description     TEXT    NOT NULL DEFAULT '',
        system_prompt   TEXT    NOT NULL DEFAULT '',
        prompt_template TEXT    NOT NULL DEFAULT '',
        input_variables TEXT    NOT NULL DEFAULT '[]',
        allowed_tools   TEXT    NOT NULL DEFAULT '[]',
        is_built_in     INTEGER NOT NULL DEFAULT 0,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agents (
        id             TEXT    PRIMARY KEY,
        name           TEXT    NOT NULL,
        description    TEXT    NOT NULL DEFAULT '',
        provider       TEXT    NOT NULL DEFAULT 'echo',
        model          TEXT,
        skill_ids      TEXT    NOT NULL DEFAULT '[]',
        max_tool_calls INTEGER NOT NULL DEFAULT 5,
        is_built_in    INTEGER NOT NULL DEFAULT 0,
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL
      );
    `
  },
  {
    version: 5,
    name: "chat",
    up: `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id            TEXT    PRIMARY KEY,
        title         TEXT    NOT NULL DEFAULT 'New chat',
        provider      TEXT    NOT NULL DEFAULT 'echo',
        model         TEXT,
        system_prompt TEXT    NOT NULL DEFAULT '',
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id         TEXT    PRIMARY KEY,
        session_id TEXT    NOT NULL,
        role       TEXT    NOT NULL,
        content    TEXT    NOT NULL DEFAULT '',
        provider   TEXT,
        model      TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_session
        ON chat_messages(session_id, created_at);
    `
  },
  {
    version: 6,
    name: "chat-tool-calls",
    up: `
      ALTER TABLE chat_sessions ADD COLUMN allowed_tools TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE chat_sessions ADD COLUMN max_tool_calls INTEGER NOT NULL DEFAULT 5;
      ALTER TABLE chat_messages ADD COLUMN tool_calls TEXT;
    `
  },
  {
    version: 7,
    name: "agent-depth",
    up: `
      ALTER TABLE agents ADD COLUMN allowed_tools TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE agents ADD COLUMN system_prompt TEXT NOT NULL DEFAULT '';
      ALTER TABLE agents ADD COLUMN goal TEXT NOT NULL DEFAULT '';
      ALTER TABLE agents ADD COLUMN schedule TEXT NOT NULL DEFAULT '{"kind":"none"}';
      ALTER TABLE chat_sessions ADD COLUMN agent_id TEXT;
    `
  },
  {
    version: 8,
    name: "tasks-rich",
    up: `
      ALTER TABLE tasks ADD COLUMN start_at INTEGER;
      CREATE TABLE IF NOT EXISTS task_labels (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        color       TEXT NOT NULL DEFAULT '#64748b',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_task_labels (
        task_id   TEXT NOT NULL,
        label_id  TEXT NOT NULL,
        PRIMARY KEY (task_id, label_id)
      );
      CREATE INDEX IF NOT EXISTS idx_task_task_labels_task ON task_task_labels (task_id);
      CREATE INDEX IF NOT EXISTS idx_task_task_labels_label ON task_task_labels (label_id);
      CREATE TABLE IF NOT EXISTS task_suggestions (
        id            TEXT PRIMARY KEY,
        agent_id      TEXT,
        agent_run_id  TEXT,
        title         TEXT NOT NULL,
        description   TEXT,
        priority      TEXT NOT NULL DEFAULT 'medium',
        due_at        INTEGER,
        status        TEXT NOT NULL DEFAULT 'pending',
        created_at    INTEGER NOT NULL,
        resolved_at   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_task_suggestions_status ON task_suggestions (status);
    `
  },
  {
    version: 9,
    name: "notes-blocks",
    up: `
      ALTER TABLE notes ADD COLUMN content_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE notes ADD COLUMN folder_id TEXT;
      UPDATE notes SET content_json = json_array(
        json_object(
          'id', lower(hex(randomblob(8))),
          'type', 'paragraph',
          'props', json_object('textColor','default','backgroundColor','default','textAlignment','left'),
          'content', CASE
            WHEN content IS NULL OR length(content) = 0 THEN json_array()
            ELSE json_array(json_object('type','text','text', content, 'styles', json_object()))
          END,
          'children', json_array()
        )
      );
      ALTER TABLE notes DROP COLUMN content;
      CREATE TABLE IF NOT EXISTS note_folders (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        parent_id   TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_note_folders_parent ON note_folders (parent_id);
      CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes (folder_id);
    `
  },
  {
    version: 10,
    name: "dashboard-extensions-views",
    up: `
      ALTER TABLE dashboard_layouts ADD COLUMN view_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_view ON dashboard_layouts (view_id);

      CREATE TABLE IF NOT EXISTS extensions (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        description      TEXT NOT NULL DEFAULT '',
        kind             TEXT NOT NULL DEFAULT 'card',
        agent_id         TEXT,
        skill_id         TEXT,
        refresh_schedule TEXT NOT NULL DEFAULT '',
        render_hints     TEXT NOT NULL DEFAULT '{}',
        is_enabled       INTEGER NOT NULL DEFAULT 1,
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS views (
        id                       TEXT PRIMARY KEY,
        group_name               TEXT NOT NULL,
        name                     TEXT NOT NULL,
        icon                     TEXT NOT NULL DEFAULT 'Folder',
        layout_id                TEXT,
        default_chat_session_id  TEXT,
        agent_ids                TEXT NOT NULL DEFAULT '[]',
        parameters               TEXT NOT NULL DEFAULT '{}',
        template_id              TEXT,
        created_at               INTEGER NOT NULL,
        updated_at               INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_views_group ON views (group_name);

      CREATE TABLE IF NOT EXISTS view_templates (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        body        TEXT NOT NULL DEFAULT '{}',
        is_built_in INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
    `
  }
];

export async function runMigrations(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);

  const result = await client.execute("SELECT version FROM _migrations ORDER BY version");
  const appliedVersions = new Set(result.rows.map((r) => r.version as number));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      // Split multi-statement SQL and run as a batch
      const statements = migration.up
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((sql) => ({ sql, args: [] as never[] }));

      await client.batch(statements, "write");
      await client.execute({
        sql: "INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)",
        args: [migration.version, migration.name, Date.now()]
      });
    }
  }
}

