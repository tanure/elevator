# ADR-0004: electron-updater with private GitHub releases

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Elevator is a Windows desktop app delivered as an NSIS installer. We
need a reliable way to ship updates to a small private audience without
running our own update server. Requirements:

- Background download with explicit user consent before applying.
- Per-version SHA-256 verification.
- Cheap or free hosting for the binaries.
- A path to add code signing later without changing the update channel.

Options considered:

1. **Custom update server** (e.g. Nuts on a tiny VPS). Operational
   overhead we do not want for an MVP.
2. **Squirrel.Windows** directly. Lower-level, more work to get the
   UX right.
3. **electron-updater** pointing at GitHub Releases. Well-trodden path,
   built-in support for private repos via a Personal Access Token.

## Decision

We use `electron-updater` against the GitHub Releases of the private
repository configured in `apps/desktop/package.json` (`build.publish`).
Releases are produced by `.github/workflows/release.yml` on tag push.

The flow:

1. CI builds the NSIS installer with `electron-builder`.
2. CI uploads the installer, `latest.yml`, and `SHA256SUMS.txt` to the
   GitHub Release.
3. The app polls GitHub on launch (and on a timer) using the credentials
   embedded at build time.
4. When an update is found, it downloads in the background.
5. The renderer's `UpdateDialog` notifies the user and prompts to
   restart.

## Consequences

**Positive**

- No update server to run.
- Free for private use within the repo's release quota.
- `electron-updater` handles SHA-256 verification automatically.
- Easy to add code signing later — we drop the signed installer into
  the same release and the channel continues to work.

**Negative**

- Requires a Personal Access Token for private-repo access. The token
  is embedded at build time, which is sensitive — we treat the
  installer as a quasi-secret artefact distributed only to trusted
  users until the project becomes public or we sign the binaries.
- GitHub release pages are not branded; the URL is visible to anyone
  with the token.

## Implementation notes

- The autoUpdater wiring lives in `apps/desktop/src/main/updater.ts`.
- The renderer subscribes to `update.state` events via the preload
  bridge; see `apps/desktop/src/renderer/src/components/UpdateDialog.tsx`.
- SmartScreen prompts on first install because we do not yet sign with
  an EV certificate. The README documents the SHA-256 verification
  workaround.
