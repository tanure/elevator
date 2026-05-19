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

