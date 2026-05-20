# ADR-0002: libSQL + Drizzle ORM for local storage

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Elevator stores notes, tasks, integration configs, jobs, audit log, and
agent runs locally. Requirements:

- Single-user, single-machine, offline-first.
- Reasonable query power (joins, indexes, ORDER BY) but no need for
  client/server semantics.
- Embeddable from the Electron main process with no extra services.
- A migration story that survives schema evolution across releases.
- TypeScript-first developer experience.

Options considered:

1. **`better-sqlite3`** — synchronous, very fast, but requires native
   builds for each Electron version.
2. **`libsql`** — fork of SQLite from the Turso team with async client,
   prebuilt N-API binaries, and a hosted-replication story we may want
   later. Drizzle ORM has a first-class adapter.
3. **`PGlite`** — Postgres-in-WASM. Too heavy for the use case.
4. **A document store (lowdb, RxDB)** — weaker query story, harder to
   migrate, no indexes worth the name.

## Decision

We use `@libsql/client` for storage and Drizzle ORM for schema, queries,
and migrations. The schema lives in `packages/data/src/schema.ts` and is
the single source of truth.

## Consequences

**Positive**

- Async API matches the rest of the main-process code.
- Drizzle gives us type-safe query results without code generation.
- Migrations are plain TypeScript and ship inside the app.
- In-memory mode (`:memory:`) makes repository unit tests trivial.
- No extra service to install or manage.

**Negative**

- libSQL is younger than `better-sqlite3`; we accept some maturity risk.
- Drizzle migrations are append-only by convention. We must be careful
  with destructive schema changes.

## Implementation notes

- The database lives at `userData/elevator.db`.
- Every table goes through a repository function in
  `packages/data/src/repositories/`. No other module issues SQL.
- Tests use `createDb(":memory:")` and clear tables in `afterEach`.
