# Contributing to Elevator

Thanks for your interest. Elevator is a small Windows-first desktop app,
and this guide assumes you have admin access on a Windows 10/11 machine
with Node.js 20+ and Git installed.

## Quick start

```powershell
git clone https://github.com/<your-fork>/Elevator.git
cd Elevator
npm install
npm run dev
```

`npm run dev` launches `scripts/dev-desktop.mjs`, which boots electron-vite
in watch mode, opens the renderer with HMR, and starts the main/preload
TypeScript watchers.

## Daily commands

Run these from the repository root.

| Command           | What it does                                                 |
| ----------------- | ------------------------------------------------------------ |
| `npm run dev`     | Watch mode for renderer + main + preload.                    |
| `npm run lint`    | `tsc --noEmit` across every workspace.                       |
| `npm test`        | Runs Vitest across `packages/data` and `apps/desktop`.       |
| `npm run build`   | Production build (tsc clean + electron-vite production).     |
| `npm run package` | Local smoke package into `apps/desktop/release-dev-*`.       |
| `npm run dist`    | Full electron-builder NSIS installer (release-only).         |

## Repository layout

```
apps/desktop/         Electron app (main, preload, renderer)
packages/shared/      Pure TS types and Zod schemas
packages/data/        Drizzle ORM schema, repositories, export helper
docs/                 Architecture and ADRs
scripts/              Dev and packaging helpers
```

See [docs/architecture.md](architecture.md) for the runtime overview.

## Coding conventions

- **TypeScript strict everywhere.** No `any`. Prefer `unknown` plus a
  narrow.
- **No raw SQL outside `packages/data`.** Add a repository function and
  re-export it.
- **No Node APIs in the renderer.** All privileged work goes through
  `window.elevator.*` via the preload bridge.
- **No background fetch from the renderer.** The main process owns the
  network. The renderer asks the main process to fetch on its behalf.
- **Logger over `console.log`.** `import { createLogger } from "./logger"`
  in the main process. The renderer uses `console` only for local
  development; production renderer crashes route through the error
  boundary.
- **Secrets never enter the database in plaintext.** Use Electron
  `safeStorage` to encrypt OAuth tokens and similar credentials.

## Tests

- Unit tests live in `src/**/__tests__/*.test.ts`.
- New repository functions need a round-trip test in `packages/data`.
- New IPC handlers should at minimum have a smoke test of their input
  validation (where complex enough to warrant it).
- Use in-memory libSQL (`createDb(":memory:")`) for repository tests.

## Pull request checklist

Before opening a PR:

1. `npm run lint` is clean.
2. `npm test` is green.
3. `plan.md` is updated if a milestone task is now complete.
4. A new ADR is added under `docs/adr/` for non-trivial architectural
   choices.
5. The commit message follows Conventional Commits
   (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).

## Releasing

Releases go through GitHub Actions. See the "Cutting a release" section
in [README.md](../README.md).

## Code of conduct

Be kind. Assume the other person had a reason. If something seems wrong,
ask. We are not building battleships.
