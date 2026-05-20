# ADR-0001: Electron-only desktop application

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Elevator is a local-first command centre for a single Windows user. We
considered three runtime options:

1. **Web app** with a small native shell (PWA / Tauri).
2. **Electron** desktop application.
3. **Native Windows app** (WinUI / .NET MAUI).

The product requires deep OS integration (file system access, system
notifications, command palette as a global window, OAuth token storage
via `safeStorage`) and a moderately complex React-based UI shared with
future extensions. The team's existing skill set is TypeScript and React.

## Decision

We build Elevator as an Electron application using React 19, Vite, and
Tailwind CSS for the renderer, and Node.js in the main process for
privileged work (database, scheduler, integrations).

## Consequences

**Positive**

- One language across the whole stack (TypeScript).
- Mature ecosystem (`electron-updater`, `electron-log`, `safeStorage`).
- Existing React + shadcn components carry directly into the renderer.
- Easy to evolve into a Copilot-extension host without rewriting the UI.

**Negative**

- Larger binary footprint than a native app (~150 MB installed).
- We must take security seriously: `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`, no remote module, no
  arbitrary navigation. Enforced in `apps/desktop/src/main/index.ts`.
- Updates require code signing for a smooth experience. The MVP ships
  unsigned and uses SHA-256 verification (see README).

## Alternatives considered

- **Tauri.** Smaller bundle, Rust-backed shell. Rejected for milestone 1
  because the team had no Rust experience and the productivity hit
  outweighed the bundle-size win for a single-user desktop tool.
- **Native WinUI.** Strong OS integration, but locks the UI layer to
  XAML and prevents sharing components with future web extensions.
