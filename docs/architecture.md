# Elevator architecture

This document describes the runtime architecture, process boundaries, and
data flow of the Elevator desktop application as of milestone 8. It is the
canonical reference for new contributors and for cross-cutting changes.

## 1. Top-level shape

Elevator is a single-process-tree Electron desktop application. There is
no web backend and no cloud-hosted state. Everything runs locally:

```
+---------------------------------------------------------------+
|  Electron app (one OS process tree)                           |
|                                                               |
|   +-------------+        IPC          +---------------------+ |
|   | Renderer    | <-----------------> | Main (Node.js)      | |
|   | (React,     |    contextBridge    | - DB, scheduler,    | |
|   |  Tailwind)  |    preload          |   integrations, AI  | |
|   +-------------+                     +---------------------+ |
|                                              |                |
|                                              v                |
|                                   +----------------------+    |
|                                   | userData/elevator.db |    |
|                                   | (libSQL / SQLite)    |    |
|                                   +----------------------+    |
+---------------------------------------------------------------+
```

There is exactly one renderer window. The renderer never has direct
access to Node APIs; all privileged work is brokered by the main process
via a typed `contextBridge` namespace exposed from `apps/desktop/src/preload/index.ts`.

## 2. Workspaces

The monorepo uses npm workspaces:

- `packages/shared` — pure-TypeScript types and Zod schemas shared between
  the main process, preload, renderer, and any future extensions.
- `packages/data` — Drizzle ORM schema, repository functions, migrations,
  and the JSON export helper. The data layer is the single owner of the
  SQLite schema; nothing else issues raw SQL.
- `apps/desktop` — the Electron application itself (main, preload, renderer).

Each package is type-checked independently with `tsc --noEmit`.

## 3. Main process

`apps/desktop/src/main/index.ts` is the entry point. On startup it:

1. Initialises `electron-log` via `logger.ts` (`initLogger()`), which sets
   up rotated file transports at `userData/logs/main.log` and chooses
   console levels based on `app.isPackaged`.
2. Installs global crash handlers (`uncaughtException`,
   `unhandledRejection`, `render-process-gone`, `child-process-gone`) so
   no failure escapes silently. Fatal main-process exceptions are logged,
   surfaced via a single error dialog, and the process exits with code 1.
3. Opens the SQLite database (`db.ts`) and applies any pending migrations.
4. Boots the scheduler and event bus.
5. Registers IPC handlers (`registerSettingsHandlers`, `registerNotesHandlers`,
   `registerTasksHandlers`, `registerIntegrationsHandlers`,
   `registerAgentsHandlers`, `registerUpdateHandlers`,
   `registerAppHandlers`, `registerDiagnosticsHandlers`,
   `registerBackupHandlers`).
6. Creates the single `BrowserWindow` with `contextIsolation: true`,
   `nodeIntegration: false`, and `sandbox: true`.

### 3.1 Logger

A single `electron-log` instance is configured once in `logger.ts`. Other
modules obtain a scoped child logger via `createLogger(scope)`. Logs
rotate at 5 MB and the previous file is renamed with a timestamp suffix.

### 3.2 Event bus

The `TypedEventBus` in `event-bus.ts` is a thin wrapper around Node's
`EventEmitter` that uses the `AppEventMap` from `@elevator/shared` to
enforce payload types at compile time. The renderer never touches the
bus directly; it subscribes through specific IPC channels.

### 3.3 Scheduler

`scheduler.ts` ticks periodically, picks up due integration syncs and
queued jobs, and emits `integration.synced` / `job.completed` /
`job.failed` events. It uses the `jobQueue` repository for persistence.

### 3.4 Integrations

`integrations/` hosts the connector registry. Built-in connectors
(Microsoft 365 mail/calendar, generic ICS, HTTP report, local CLI, and a
generic MCP Server) implement a tiny interface: `check`, `listTools`,
`callTool`, plus optional `connect`, `sync`, and
`listContextProviders`.

The **MCP Server** connector is template-driven and multi-instance: the
user enters a `command`, `args`, optional `env` and `cwd`, and the
connector spawns the server over stdio via
`@modelcontextprotocol/sdk`, discovers its tools via `listTools()`, and
exposes them to the agent runtime as `mcp:<instanceId>:<toolName>`. This
is how third-party MCP servers (e.g. `npx -y @microsoft/work-iq`) plug
in without code changes.

OAuth tokens and other secrets are stored using Electron `safeStorage`
(encrypted at rest with the user's OS credential) — never in plaintext
in the database.

## 4. Preload

`apps/desktop/src/preload/index.ts` exposes a single global,
`window.elevator`, structured by feature namespace:

- `settings`, `notes`, `tasks`, `integrations`, `agents`, `update`
- `app` — info + `logRendererError` for the error boundary
- `diagnostics` — `snapshot`, `openLogs`, `openDataFolder`
- `backup` — `exportDatabase`, `exportJson`

Each method validates its arguments before dispatching to the main
process. The preload never holds business logic; it is a thin adapter.

## 5. Renderer

The renderer is React 19 + React Router (hash routing). The top-level
component tree is:

```
<ErrorBoundary>
  <HashRouter>
    <AppLayout>
      <Outlet/>  // route content
    </AppLayout>
    <UpdateDialog/>
  </HashRouter>
</ErrorBoundary>
```

`ErrorBoundary` forwards renderer crashes to the main logger via
`window.elevator.app.logRendererError`. Users see a friendly card with
a "Copy details" action and a "Reload app" button.

Routes:

| Path            | Screen        |
| --------------- | ------------- |
| `/`             | Dashboard     |
| `/notes`        | Notes         |
| `/tasks`        | Tasks         |
| `/integrations` | Integrations  |
| `/agents`       | Agents        |
| `/diagnostics`  | Diagnostics   |
| `/settings`     | Settings      |

State is held in Zustand stores under `renderer/src/stores`. IPC calls
return plain JSON and update the relevant store.

## 6. Persistence

The single source of truth is `userData/elevator.db` (a libSQL/SQLite
file). Drizzle ORM migrations live in `packages/data/src/schema.ts`.

Tables: `settings`, `notes`, `tasks`, `integrations`, `audit_log`,
`dashboard_layouts`, `job_queue`, `agent_runs`, `prompt_templates`.

`packages/data/src/export.ts` produces a JSON snapshot of every
user-owned table with optional secret redaction. This is what powers the
JSON backup button on the Diagnostics screen.

## 7. Diagnostics & backup

The Diagnostics screen calls `diagnostics.snapshot()` to render app and
OS versions, paths (`userData`, `logs`, `db`), database stats, scheduler
job counts, and the integration list. Two action groups:

- **Open** — `Open logs folder`, `Open data folder` (both via `shell.openPath`).
- **Backup** — `Export database` (file copy of the `.db` with a save
  dialog) and `Export JSON` (calls `exportAll(db, { redactSecrets: true })`
  and writes the result to a user-chosen file).

The user is always prompted for the destination; nothing is written
without consent.

## 8. Updates

`electron-updater` polls a private GitHub release feed configured in
`apps/desktop/package.json` (`build.publish`). New versions download
silently and the renderer is notified via `update.state` events. The
`UpdateDialog` component handles the restart prompt.

## 9. Testing

- `packages/data` — unit tests for repositories, settings round-trips,
  and `exportAll` redaction behaviour (in-memory libSQL).
- `apps/desktop` — unit tests for the typed event bus and the ICS parser.
- `apps/desktop/e2e/` — Playwright smoke tests that drive the packaged
  Electron build. Run with `npm run build` then
  `npm run -w @elevator/desktop test:e2e`. Each spec uses an isolated
  `userData` directory so it never touches the real profile.

Run all unit tests with `npm test` from the repository root.

## 10. Known gaps

- Playwright coverage is intentionally minimal (boot, sidebar, two
  routes). Broader UI flows still rely on manual smoke.
- No telemetry. Diagnostics are local-only and shared only when the user
  explicitly exports them.
