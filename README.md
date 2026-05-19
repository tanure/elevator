# Elevator

Elevator is a local-first Windows desktop command centre for managing the working day. The MVP is an Electron application with a configurable dashboard, extension-contributed cards, proactive routines, and future-ready integration points for APIs, MCP, CLI tools, agents, skills, and the GitHub Copilot SDK.

## Current milestone

Milestone 1 establishes the desktop shell:

- TypeScript workspace structure.
- Electron main, preload, and renderer processes.
- React + Vite + Tailwind CSS + shadcn/ui-style component foundation.
- Secure Electron defaults with a typed preload bridge.
- Initial extension, dashboard card, and routine contracts.
- Baseline scripts for development, build, test, and local package smoke checks.

## Scripts

Run from the repository root:

```powershell
npm install
npm run dev
npm run lint
npm test
npm run build
npm run package
```

`npm run package` writes each local smoke package to a timestamped `apps\desktop\release-dev-*` directory to avoid Windows file-locking issues during iterative builds.


## Releases and updates

Elevator publishes Windows installers to a private GitHub release feed. The in-app updater downloads new versions silently in the background and asks the user to restart when one is ready (Settings → Application).

### Cutting a release

1. Fill `build.publish.owner` and `build.publish.repo` in `apps/desktop/package.json` (one time).
2. Bump `version` in `apps/desktop/package.json`.
3. Commit and tag: `git tag v0.x.0 && git push --tags`.
4. The `.github/workflows/release.yml` workflow builds the NSIS installer, publishes it to GitHub Releases, and uploads `SHA256SUMS.txt`.

### SmartScreen on first install

Builds are unsigned today (no EV certificate). Windows SmartScreen will warn on first launch. Click `More info` → `Run anyway`. Verify the installer's SHA-256 against `SHA256SUMS.txt` from the release before installing.

