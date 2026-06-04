# Elevator local-first MVP plan

## Problem statement

Elevator is a personal Windows desktop command centre for managing the user's working day from one place: reports, calendar, tasks, emails, meetings, notes, automations, agents, skills, LLM interactions, and integrations with external applications.

The first version should run locally on the user's machine as an installed Electron application. It should be architected for extensibility from the start, especially for API integrations, MCP servers, CLI tools, GitHub Copilot SDK workflows, local agents, and future cloud-ready capabilities.

The implementation repository should be created at `C:\Projects\Elevator`.

## MVP scope

The agreed MVP direction is local-first.

In scope:

- Windows-first installed Electron application named Elevator.
- Local-first user data and configuration.
- Configurable daily control-plane dashboard where extensions can contribute cards, list views, tasks, summaries, and proactive recommendations.
- Extensible integration framework for APIs, MCP servers, and CLI tools.
- LLM and agent orchestration foundation, including GitHub Copilot SDK integration patterns.
- Skill/plugin-style feature modules so new capabilities can be added without rewriting the core app.
- Proactive routines that can run on a schedule, at app startup, or on demand, such as creating an 8 AM report-check task with a link to the relevant report.
- GitHub-based release publishing and in-app update detection/management.
- Container-based optional dependencies for services that should not be embedded directly, such as heavier databases, queues, or local service workers.
- Security boundary between Electron renderer, main process, local services, credentials, and tools.

Out of scope for the first MVP:

- Multi-user or team collaboration.
- Mobile clients.
- Cross-device sync.
- Full cloud-hosted backend.
- Marketplace for third-party plugins.
- Enterprise administration.
- Production Azure deployment, except where architecture should remain compatible with future Azure hosting.

## Discovery notes and assumptions

- The application is for a single user initially.
- Windows is the first packaging target, but Electron should keep macOS/Linux portability feasible.
- The app should prefer local execution and local storage unless an integration necessarily calls an external API.
- GitHub will be used for source hosting, releases, and update metadata.
- GitHub Copilot SDK should be treated as a first-class AI integration surface.
- For Copilot SDK Azure BYOM later, the supported pattern is `bearerToken` with `DefaultAzureCredential` locally and managed identity in production; model/provider configuration should remain environment-driven.
- The MVP should avoid overcommitting to Docker for everything. Embedded SQLite is the recommended local metadata store for the desktop app, while containers should be reserved for optional dependencies that benefit from isolation.
- The Dashboard should not be hardcoded as a fixed set of widgets. It should be a configurable canvas powered by extensions, cards, routines, and user layout preferences.
- A connection is not the same as a dashboard feature. A connection provides authenticated access to a system such as Work IQ, Microsoft 365, GitHub, a report portal, an MCP server, or a CLI. An extension uses one or more connections to provide user-facing cards, commands, routines, agents, and settings.

## Proposed architecture

### High-level shape

Elevator should be structured as a desktop shell plus local orchestration services:

- Electron main process: application lifecycle, window management, auto-updates, secure IPC, local service supervision, OS integration.
- Electron renderer: React-based user interface for dashboard, command centre, notes, tasks, integrations, agents, and settings.
- Preload bridge: narrow, typed IPC API between renderer and main process.
- Local core service: Node.js/TypeScript service layer for domain logic, integration scheduling, indexing, tool execution, and agent orchestration.
- Local data layer: SQLite for configuration, cached entities, notes, task state, integration metadata, audit trail, and local queue metadata.
- Integration runtime: adapters for Microsoft 365, GitHub, local CLI tools, MCP servers, filesystem integrations, and future APIs.
- AI runtime: abstraction over GitHub Copilot SDK sessions, model selection, tool calling, agent execution, prompt templates, and skill invocation.
- Optional container services: Postgres, Redis, queue workers, vector database, or local search services only when a feature justifies them.

### Recommended initial stack

| Area | Recommendation | Rationale |
|---|---|---|
| Desktop shell | Electron | Matches portability and Windows installer requirement. |
| Language | TypeScript | Shared types across main, renderer, local services, and integrations. |
| UI | React + Vite, TailwindCss, Shadcn | Fast local development and strong Electron ecosystem support. |
| UI state | Zustand or Redux Toolkit | Start simple; keep server/cache state separate. |
| Local DB | SQLite | Best fit for local-first MVP without requiring containers. |
| DB access | Drizzle ORM or Prisma | Typed schema and migrations. Drizzle is lighter; Prisma is broader. |
| Background jobs | SQLite-backed queue initially | Avoid Redis dependency until real queue pressure exists. |
| Optional containers | Docker Compose profiles | Run heavier dependencies only when enabled. |
| AI SDK | `@github/copilot-sdk` | First-class Copilot SDK support. |
| MCP | Local MCP client/registry layer | Allows integrations to be added as tools. |
| Packaging | electron-builder | Windows installer, code signing path, GitHub Releases publishing. |
| Updates | electron-updater with GitHub provider | Supports release checks and update flow from GitHub Releases. |
| Testing | Vitest + Playwright | Unit/service tests and desktop/UI smoke tests. |
| CI | GitHub Actions | Build, test, package, and publish releases. |

### Core domain modules

1. Shell and platform
   - App lifecycle.
   - Secure IPC.
   - Tray/menu integration.
   - Auto-launch setting.
   - Update checks and installation flow.
   - Local service process supervision.

2. Dashboard
   - Configurable card canvas.
   - User-selected dashboard layout.
   - Extension-contributed cards.
   - Card types such as list, task list, summary, metric, link, timeline, alert, and agent recommendation.
   - Today's agenda and meetings as one possible card, not a hardcoded dashboard assumption.
   - Priority tasks and scheduled routines.
   - Email and report summaries.
   - Meeting preparation cards.
   - Notes and quick capture.
   - Agent recommendations and "walk me through my day" briefing.

3. Integrations
   - Integration registry.
   - OAuth/token storage strategy.
   - API connectors.
   - MCP connector registry.
   - CLI connector registry.
   - Health/status checks.

4. AI and agents
   - Copilot SDK client wrapper.
   - Session management.
   - Model/provider configuration.
   - Agent runner interface.
   - Tool registry.
   - Skill registry.
   - Prompt templates and system policies.
   - Audit trail for tool calls and agent actions.

5. Local data
   - User settings.
   - Notes.
   - Tasks.
   - Dashboard layouts and enabled cards.
   - Extension manifests and permissions.
   - Routine definitions and run history.
   - Calendar/email/report cache metadata.
   - Integration definitions.
   - Agent run history.
   - Update state.
   - Local audit log.

6. Reports and daily operating system
   - Report cards.
   - Scheduled report-check routines.
   - Generated tasks with deep links to reports.
   - Daily brief.
   - Meeting prep.
   - Follow-up extraction.
   - End-of-day summary.

7. Routines and proactivity
   - Schedule-based triggers, such as every weekday at 8 AM.
   - App-start triggers, such as "when Elevator opens, prepare my day".
   - Connection-based triggers, such as when new meeting data or report status is available.
   - User-confirmed actions for anything outbound or destructive.
   - Routine outputs such as dashboard cards, tasks, notes, notifications, summaries, and agent runs.

## Dashboard, extensions, cards, and routines

The Dashboard should be treated as a configurable surface rather than a fixed feature. The correct model is:

| Concept | Role | Example |
|---|---|---|
| Connection | Authenticated access to an external or local system. | Work IQ, Microsoft 365, GitHub, report portal, MCP server, local CLI. |
| Extension | A feature package that uses one or more connections and contributes UI, commands, routines, tools, or agents. | "Workday Extension", "Reports Extension", "Meetings Extension". |
| Card | A visible dashboard unit contributed by an extension. | "Today's meetings" list view, "Reports to check", "Blocked tasks", "Urgent email summary". |
| Routine | A scheduled or event-driven workflow that creates work for the user or prepares information. | "Every weekday at 8 AM, check required reports and create today's report tasks." |
| Tool | A callable capability that an agent or routine can use with permission. | `listTodaysMeetings`, `getReportStatus`, `openReport`, `summarizeInbox`. |

This means a Work IQ integration should first be modelled as a connection. Once connected, an extension can expose a "Today's meetings" dashboard card that renders a list view using Work IQ, Microsoft 365, or another configured source. The same connection can also expose agent tools so Copilot SDK-powered agents can answer questions, prepare meetings, or generate a daily briefing.

For reports, the preferred design is not to hardcode reports into the Dashboard. Instead, create a Reports extension with configurable report definitions:

- Report name.
- Link or launch command.
- Owner or source system.
- Schedule, such as weekdays at 8 AM.
- Required check frequency.
- Status query method, if available.
- Task template.
- Optional agent prompt for summarising what needs attention.

At runtime, the routine engine evaluates the schedule and creates dashboard tasks or cards such as "Check Finance Report" with a link to the report. This gives Elevator its proactive behaviour while keeping the Dashboard user-configurable.

## Security and privacy model

- Disable direct Node.js access in the renderer.
- Use `contextIsolation: true`, `nodeIntegration: false`, and a typed preload API.
- Store credentials in the OS credential vault where possible.
- Keep API tokens out of local SQLite unless encrypted and unavoidable.
- Require explicit user approval before high-impact actions such as sending messages, deleting data, installing integrations, running arbitrary CLI commands, or updating the app.
- Maintain an audit log for agent/tool activity.
- Treat external content from email, files, web pages, or integrations as untrusted input.
- Keep local-first defaults: private data should not leave the machine unless an enabled integration or LLM call requires it and the user has configured it.

## GitHub Copilot SDK strategy

The MVP should include an AI provider abstraction with Copilot SDK as the first provider.

Initial design:

- Add a `CopilotProvider` implementation around `@github/copilot-sdk`.
- Support GitHub default model first.
- Allow specific GitHub model selection through settings when model discovery is implemented.
- Keep BYOM-ready configuration fields but do not require Azure setup in the MVP.
- For future Azure BYOM support, require fresh bearer tokens per request and environment-driven `MODEL_NAME` and endpoint settings.
- Route all LLM calls through the AI runtime so future providers do not leak into UI or domain modules.

## Extensibility strategy

Elevator should support feature growth through internal modules first, then external plugin capability later.

MVP extensibility surfaces:

- Feature module manifest with id, name, routes, permissions, settings schema, commands, tools, and background jobs.
- Dashboard card contribution manifest with supported card size, renderer component, data provider, refresh policy, and required permissions.
- Routine contribution manifest with schedule, app-start trigger support, inputs, outputs, permissions, and failure policy.
- Integration adapter interface for APIs, MCP servers, and CLI tools.
- Tool registry exposed to agents with explicit permission metadata.
- Skill registry for reusable prompt/workflow packs.
- Command palette for user-invoked actions.
- Event bus for domain events such as `calendar.synced`, `email.summarized`, `routine.completed`, `agent.completed`, and `update.available`.

Plugin marketplace, remote plugin installation, and untrusted third-party code execution should be deferred.

## Release and update strategy

- Use GitHub repository for source control and release publishing.
- Use GitHub Actions to build signed or unsigned development artifacts initially.
- Use electron-builder to produce a Windows installer.
- Publish releases to GitHub Releases.
- Use electron-updater GitHub provider for update checks.
- Add an update settings screen with current version, latest version check, release notes link, and install/restart flow.
- For early MVP, support manual confirmation before installing updates.

## Implementation milestones

### Milestone 1: Repository and desktop shell ✅

Create the Elevator repository structure and baseline Electron app.

Deliverables:

- Project root at `C:\Projects\Elevator`.
- TypeScript monorepo or workspace structure.
- Electron main, preload, and React renderer.
- Secure IPC foundation.
- Basic navigation shell.
- App settings placeholder.
- Developer scripts for start, build, lint, test, and package.

### Milestone 2: Local data and domain foundation ✅

Add durable local state and core domain contracts.

Deliverables:

- SQLite database setup.
- Migration strategy.
- Typed data access layer.
- Settings, notes, tasks, integrations, and audit-log tables.
- Local event bus.
- Background job abstraction.

### Milestone 3: Daily dashboard MVP ✅

Build the first useful configurable control-plane experience.

Deliverables:

- Dashboard canvas with configurable cards.
- Dashboard layout persistence.
- Card registry and extension card contribution model.
- Quick notes.
- Local tasks.
- Manual report-check cards and task cards.
- Meeting list card placeholder that can later be backed by Work IQ or Microsoft 365.
- Routine output area for proactive generated tasks and recommendations.
- Command palette foundation.
- Basic search across local notes/tasks.

### Milestone 4: Integration runtime ✅

Create the foundation for external systems and connection-backed extensions.

Deliverables:

- Integration registry.
- API connector interface.
- MCP connector interface.
- CLI tool connector interface.
- Connection status UI similar to the provided Work IQ / Microsoft 365 settings example.
- Integration health checks.
- Permission model for integrations and tools.
- First local CLI connector as a proof of concept.
- Work IQ connector design as a first-class connection candidate.

### Milestone 5: AI and agent runtime ✅

Add the LLM and agent layer without hardwiring it into the UI.

Deliverables:

- AI provider abstraction.
- Copilot SDK provider.
- Agent runner.
- Tool registry.
- Skill registry.
- Prompt template storage.
- Agent run history and audit log.
- Simple agent-assisted daily brief or task summariser using card and routine outputs.

### Milestone 6: Productivity integrations

Restructured into two phases. Phase 6A delivers the UI-driven add-integration
framework (templates + named instances, dynamic forms, secret vault, lifecycle IPC).
Phase 6B ships the first four real connectors on top of that framework.

#### Phase 6A — Add-integration UI framework (✅ complete)

Delivered:

- Shared `ConnectorTemplate` / `Integration` (instance) / `ConnectorModule` model with
  per-template config schema (`string|secret|number|boolean|select|path|url`),
  permissions, optional `supportsMultipleInstances`, and validation types.
- Data layer migration v3 with `integration_instances` table and repository.
- Secret vault using Electron `safeStorage` (ciphertext file at
  `userData/secrets.json`, mode 0o600, keyed `${instanceId}:${fieldKey}`).
- Existing `cli` and `workiq` connectors refactored from singletons to templates +
  named instances; template registry drives the UI catalogue.
- 12 IPC channels: `integrations:{list, listTemplates, create, update, delete, test,
  connect, disconnect, check, sync, listTools, callTool}`. `callTool` signature is
  now `(instanceId, toolId, input)`. Audit log on every mutation.
- Preload bridge updated to match. New event-bus keys: `integration.created`,
  `integration.updated`, `integration.deleted`, `integration.synced`.
- Renderer: `useIntegrationsStore` with create/update/remove/test/sync, schema-driven
  `ConnectorForm`, `AddIntegrationDialog` (two-step picker, hides already-instantiated
  single-instance templates), `IntegrationFormDialog` (unified create/edit with Test
  connection + permissions panel), and an Integrations route with empty state,
  Add button, and per-card Edit / Delete / Sync / Check / Connect / Disconnect.
- Verified: `tsc` clean across `apps/desktop`, `packages/data`, `packages/shared`;
  `vitest` in `@elevator/data` passing 6/6.

#### Phase 6B — First real connectors (✅ complete)

Delivered:

- OAuth 2.0 loopback helper at `apps/desktop/src/main/integrations/oauth.ts`
  (random localhost port + PKCE S256 + CSRF state + `shell.openExternal` to system
  browser) and `refreshAccessToken` for silent renewal.
- Per-instance JSON cache at `userData/integration-cache/<instanceId>.json` mode 0o600
  (`getSyncCache`/`setSyncCache`/`getOAuthTokens`/`setOAuthTokens`/`clearCache`).
  Cache lifecycle is tied to instance lifecycle (deleted with the instance).
- Shared Microsoft Graph helper (`graph.ts`) handling OAuth bootstrap,
  refresh-on-expiry, and bearer-token `graphFetch<T>(ctx, scopes, path, query?)`.
- ICS connector — RFC 5545 minimal parser (`ics.ts`), reads HTTPS feeds or local
  files; tool `ics.upcoming`; `sync()` returns `IntegrationSyncData { kind: "calendar" }`.
- Generic HTTP report connector — configurable endpoint, auth header, JSON dot-paths
  for headline + rows; tool `http.fetch`; `sync()` returns `kind: "report"`.
- Microsoft 365 Calendar connector — `Calendars.Read User.Read`, queries
  `/me/calendarView`; tool `m365cal.upcoming`; `sync()` returns `kind: "calendar"`.
- Microsoft 365 Mail connector — `Mail.Read User.Read`, queries
  `/me/mailFolders/Inbox/messages`; tool `m365mail.recent`; `sync()` returns `kind: "mail"`.
- Registry wiring — `Connector` interface gained optional `sync`/`connect` hooks;
  registry dispatches to them and emits `integration.synced { id, ok }`. New
  `integrations:getSyncData` IPC channel + preload bridge.
- Dashboard cards — `UpcomingEventsCard`, `RecentMailCard`, `ReportStatusCard`
  aggregate sync data across all connected instances by `kind`. AgendaCard placeholder
  retired.
- Consent dialog — `ConsentDialog.tsx` gates `AddIntegrationDialog` whenever a
  template declares `requiredPermissions` or `networkTargets`, listing both before
  the user proceeds to credential entry.
- Verified: `tsc` clean across `apps/desktop`, `packages/data`, `packages/shared`;
  `vitest` in `@elevator/data` passing 6/6.

Out of scope for M6 (tracked separately):

- Microsoft Agent 365 — design captured in ADR-0005; scaffold landed
  alongside M8E and full implementation is tracked under Milestone 9
  below.

### Milestone 7: Packaging, releases, and updates

Make Elevator installable and update-aware.

Deliverables:

- Windows packaging with electron-builder.
- GitHub Actions build pipeline.
- GitHub Releases publishing path.
- In-app version display.
- Update check flow.
- Update available UI.
- User-confirmed download/install/restart flow.

#### Phase 7A — Auto-update foundations (✅ delivered)

- NSIS per-user installer config (`oneClick:false`, `perMachine:false`,
  `allowToChangeInstallationDirectory:true`, `allowElevation:false`) and
  `${productName}-Setup-${version}.${ext}` artifact name.
- `electron-updater` + `electron-log` integrated in `apps/desktop/src/main/updater.ts`.
  Silent background check 30 s after launch; background download; user-confirmed
  restart via `quitAndInstall(false, true)`.
- Private-repo publish target wired through `build.publish.private:true` in
  `apps/desktop/package.json`. Owner/repo are placeholders to be filled before
  the first tagged release.
- Shared types added: `UpdateStatus`, `UpdateProgress`, `UpdateState`. Event map
  extended with `update.state`.
- IPC handler (`updates:check`, `updates:getState`, `updates:install`) +
  preload bridge (`window.elevator.updates.*`, `window.elevator.on.updateState`).
- Renderer `useUpdatesStore` (Zustand) mirrors state. `UpdateDialog` mounted at
  the app root prompts on `downloaded` and is dismissable per-version.
- Settings → Application section shows version, last-checked timestamp, status
  badge, "Check for updates" button, progress %, and "Restart and install" CTA.
- GitHub Actions workflow at `.github/workflows/release.yml` builds the NSIS
  installer on `v*` tags, publishes via electron-builder, and uploads
  `SHA256SUMS.txt` to the release.
- Code signing intentionally deferred (no EV cert). Mitigations:
  `signAndEditExecutable:false`, checksums file, README guidance on SmartScreen.

#### Phase 7B — Release readiness (✅ delivered)

- `build.publish.owner` / `repo` filled in `apps/desktop/package.json`
  (`tanure` / `elevator`).
- Ready to cut the first `v0.x.0` tag. Workflow at
  `.github/workflows/release.yml` will build the NSIS installer, publish via
  electron-builder, and attach `SHA256SUMS.txt`.

##### How to cut the first release

1. Bump `version` in `apps/desktop/package.json` if needed.
2. Commit on `main`.
3. `git tag v0.1.0 && git push origin v0.1.0`.
4. GitHub Actions runs `release.yml` and publishes the installer as a
   GitHub Release on `tanure/elevator`.
5. On a clean Windows host, install the produced
   `Elevator-Setup-0.1.0.exe`, launch the app, then bump the version,
   tag `v0.1.1`, push, and verify the in-app updater downloads and
   installs the new build.

### Milestone 8: Hardening and developer experience

Prepare the MVP for sustained development.

Deliverables:

- Error boundary and crash handling.
- Structured logging.
- Diagnostics screen.
- Backup/export path for local data.
- Test coverage for core services.
- UI smoke tests.
- Developer documentation.
- Architecture decision records.

#### Phase 8A — Crash handling and logging (✅ delivered)

- Centralised `electron-log` bootstrap in `apps/desktop/src/main/logger.ts`
  with rotated file transport at `userData/logs/main.log` and scoped child
  loggers via `createLogger(scope)`. Console level depends on `app.isPackaged`.
- Global handlers in `main/index.ts` for `uncaughtException`,
  `unhandledRejection`, `render-process-gone`, and `child-process-gone`.
  Fatal main-process errors surface via a single `dialog.showErrorBox` and
  `app.exit(1)`.
- Renderer `ErrorBoundary` (`renderer/src/components/ErrorBoundary.tsx`)
  catches crashes, forwards `{ message, stack }` to the main logger via
  `window.elevator.app.logRendererError`, and renders a friendly card with
  "Copy details" and "Reload app" actions.
- `registerAppHandlers()` exposes `app:logRendererError`.
- `updater.ts` switched to a scoped logger (no duplicate transport config).

#### Phase 8B — Diagnostics screen (✅ delivered)

- New `/diagnostics` route (`renderer/src/routes/Diagnostics.tsx`) and nav
  item with the `HeartPulse` icon in `AppLayout`.
- `registerDiagnosticsHandlers()` exposes
  `diagnostics:snapshot`, `diagnostics:openLogs`, `diagnostics:openDataFolder`.
- `DiagnosticsSnapshot` type added to `@elevator/shared`.
- Snapshot contains app + OS + Electron versions, paths (userData, logs, db),
  database size, integration list, scheduler job counts, captured timestamp.
- Page sections: Application, Paths, Database, Scheduler, Integrations table,
  Backup & export. "Copy diagnostics" copies the JSON snapshot to the
  clipboard.

#### Phase 8C — Backup and JSON export (✅ delivered)

- New `packages/data/src/export.ts` with `exportAll(db, opts)` returning an
  `ExportSnapshot` covering notes, tasks, integrations, jobs, settings,
  audit log, and agent runs.
- Recursive secret redaction toggled by `redactSecrets: true`; matches keys
  by `/(token|secret|key|password|credential|authorization)/i` and walks
  nested objects.
- `registerBackupHandlers()` exposes `backup:exportDatabase` (file copy of
  the `.db` with a save dialog) and `backup:exportJson` (writes the redacted
  snapshot). User is always prompted for the destination.

#### Phase 8D — Tests (✅ delivered, 28 passing)

- `packages/data` — repositories (existing), `integrations.test.ts`,
  `export.test.ts` (redaction round-trip), 15 tests total.
- `apps/desktop` — `event-bus.test.ts` (5 tests), `ics.test.ts`
  (8 tests covering UTC, all-day, escapes, line folding, missing UID,
  ORGANIZER CN, skip-on-missing-DTSTART).
- `apps/desktop/vitest.config.ts` added.

#### Phase 8F — Documentation and ADRs (✅ delivered)

- `docs/architecture.md` — process topology, IPC boundary, workspaces,
  routing, persistence, diagnostics, updates, testing.
- `CONTRIBUTING.md` — quick start, daily commands, layout, conventions,
  PR checklist.
- `docs/adr/ADR-0001-electron-only-desktop.md`.
- `docs/adr/ADR-0002-libsql-drizzle-storage.md`.
- `docs/adr/ADR-0003-event-bus-typed.md`.
- `docs/adr/ADR-0004-electron-updater-private-releases.md`.

#### Phase 8E — Playwright Electron smoke tests (✅ delivered)

- `apps/desktop/e2e/` — Playwright config plus a single `smoke.spec.ts`
  that launches the packaged Electron build (`out/main/index.js`) with
  an isolated `userData` temp dir.
- Coverage: app boots and shows the sidebar, Diagnostics route mounts
  and renders its snapshot, Chat route mounts at `#/chat`.
- Wired as `npm run -w @elevator/desktop test:e2e`. Devs run
  `npm run build` first; CI runs both in sequence.
- `@playwright/test` added as a devDependency. Browsers are not
  required (Electron only); no `playwright install` step needed.

Out of scope for M8 (now tracked under M9):

- Deeper end-to-end coverage of the AI provider switcher, MCP tool
  registration, and dashboard cards. Lands incrementally as those
  surfaces stabilise.

### Milestone 9: Microsoft Agent 365

Treat the Microsoft 365 Agents surface as a first-class connector,
distinct from the existing Graph-based Calendar/Mail wrappers.
Design captured in [`docs/adr/ADR-0005-microsoft-agent-365.md`](docs/adr/ADR-0005-microsoft-agent-365.md).

#### Phase 9A — Design + scaffold (✅ delivered)

- ADR-0005 documents why Agent 365 lives outside the existing Graph
  connectors and what the M9 surface owes the rest of the app.
- `apps/desktop/src/main/integrations/connectors/m365-agent.ts` ships
  the `ConnectorTemplate` (tenant / clientId / agentId / endpoint
  fields) and a stub `Connector` whose lifecycle methods return
  "not implemented".
- The module is registered only when
  `ELEVATOR_ENABLE_M365_AGENT=1`, so the template never appears in
  the production catalogue.

#### Phase 9B — Auth + token isolation (✅ delivered)

- Dedicated `agents-api.ts` helper analogous to `graph.ts` with its own
  `ensureAgentsConnect` and `agentsFetch` functions.
- Token isolation via per-instance cache (inherent in `cache.ts` design).
- OAuth loopback + PKCE flow reusing existing `oauth.ts` infrastructure.
- Endpoint allowlist security: only HTTPS to `graph.microsoft.com`,
  `substrate.office.com`, `api.microsoft.com` — prevents bearer token
  exfiltration to arbitrary endpoints.
- Rate-limit handling: automatic retry on 429/503 with Retry-After parsing
  (GET retries by default; POST requires explicit opt-in).
- `agentId` made required in the config schema.

#### Phase 9C — Agent invocation tools (✅ delivered)

- `m365agent.invoke` — send a message to the agent (creates/continues threads),
  polls for async agent reply with timeout.
- `m365agent.threads.list` — list recent conversation threads.
- `m365agent.threads.read` — read messages from a specific thread.
- Tools use the Microsoft Graph beta chat substrate (`/me/chats`).
- `sync()` hook returns `IntegrationSyncData { kind: "custom" }` with typed
  `m365-agent.activity.v1` payload containing thread summaries (no sensitive
  message bodies in cache — metadata only).

#### Phase 9D — Dashboard + telemetry (✅ delivered)

- `AgentActivityCard.tsx` dashboard card showing recent agent threads with
  timestamps, registered as `agent-activity` in the card catalogue.
- Card filters by `templateId === "m365-agent"` and validates typed payload
  (`m365-agent.activity.v1`) to avoid collisions with other custom sync data.
- Diagnostics integration: `check()` returns auth status and notes agent
  invocation depends on agent availability — surfaces in the integrations
  table of the diagnostics snapshot automatically.
- 14 unit tests in `m365-agent.test.ts` covering: endpoint allowlist
  validation, agentsFetch retry behaviour, tool routing, input validation,
  sync data shape and cache persistence, best-effort on fetch failures.

## Suggested repository layout

```text
elevator/
  apps/
    desktop/
      src/
        main/
        preload/
        renderer/
  packages/
    core/
    data/
    integrations/
    ai/
    agents/
    skills/
    shared/
  containers/
    docker-compose.yml
  scripts/
  docs/
    architecture/
    adr/
  .github/
    workflows/
```

## Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Electron security mistakes | Enforce secure defaults, typed preload bridge, no renderer Node access. |
| Scope creep | Keep MVP local-first and defer sync, marketplace, and multi-user workflows. |
| AI provider lock-in | Use an AI provider abstraction and keep Copilot SDK behind a provider boundary. |
| Plugin security | Start with internal modules and signed/trusted integrations only. |
| Credential exposure | Use OS credential storage and explicit permission boundaries. |
| Over-containerisation | Use SQLite first; add containers only for justified optional services. |
| Update reliability | Use established electron-builder/electron-updater GitHub release flow. |

## Open questions for later discovery

- Which productivity source should be integrated first: Microsoft 365 calendar, email, local files, GitHub, or a task system?
- Should the first release be private/internal only or public on GitHub?
- Will the application need code signing for the first Windows release?
- Which Copilot SDK model path should be the first target: GitHub default, GitHub model selection, or Azure BYOM?
- Should Elevator expose local APIs to other tools, or remain UI-only initially?
- Should integrations be configured manually first, or discovered automatically from local credentials and installed CLIs?

## Immediate next step when implementation starts

Start with Milestone 1 by creating the Electron/TypeScript workspace, choosing package management conventions, setting secure Electron defaults, and establishing the initial app shell.
