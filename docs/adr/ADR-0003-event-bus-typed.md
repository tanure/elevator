# ADR-0003: Typed in-process event bus

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

The main process has multiple subsystems that need to react to each
other: the scheduler completes a job, the integrations layer finishes a
sync, the database layer mutates a row, and the renderer needs to know.
We wanted a single decoupling point so that, for example, the
integrations module does not directly depend on the IPC layer.

We considered:

1. **Direct method calls** — fast and simple but creates a fan-out web
   of dependencies and makes testing awkward.
2. **A message bus library** (RxJS, mitt, EventEmitter3) — extra
   dependency for a small need.
3. **Node's built-in `EventEmitter`** wrapped with TypeScript generics.

## Decision

We use a single `TypedEventBus` (`apps/desktop/src/main/event-bus.ts`)
that extends Node's `EventEmitter` and is parameterised by an
`AppEventMap` interface exported from `@elevator/shared`. Producers emit
strongly-typed payloads; consumers receive strongly-typed payloads.

```ts
eventBus.emit("integration.synced", { id: "gh-1", ok: true });

eventBus.on("integration.synced", ({ id, ok }) => {
  // id: string, ok: boolean — checked at compile time
});
```

## Consequences

**Positive**

- Zero new runtime dependencies.
- Compile-time safety on every event payload — adding a new event is a
  single edit in `@elevator/shared` and the compiler tells us where the
  producer and consumer code needs to change.
- Easy to unit-test (`vi.fn()` listeners and synchronous `emit`).

**Negative**

- Pure in-process: the bus does not cross the IPC boundary on its own.
  When the renderer needs to react, the IPC layer subscribes on the
  main side and pushes via `webContents.send`. Acceptable for our scope.
- Listener leaks are possible. We discipline ourselves to call `off`
  on shutdown paths.

## Implementation notes

- `AppEventMap` (in `packages/shared/src/index.ts`) is the authoritative
  list of events. Any new event must be added there first.
- The bus is a singleton (`export const eventBus = new TypedEventBus()`).
- Tests live in `apps/desktop/src/main/__tests__/event-bus.test.ts`.
