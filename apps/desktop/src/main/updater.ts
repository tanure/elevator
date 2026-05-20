import { app, BrowserWindow } from "electron";
import electronUpdaterPkg, { type UpdateInfo, type ProgressInfo } from "electron-updater";
import type { UpdateState } from "@elevator/shared";
import { createLogger, log as electronLog } from "./logger.js";

// electron-updater is CommonJS; named ESM imports are not supported.
const { autoUpdater } = electronUpdaterPkg;

const log = createLogger("updater");

/**
 * Auto-update integration backed by electron-updater + private GitHub Releases.
 *
 * Flow:
 * 1. On app start, `initUpdater()` configures logging and schedules a silent
 *    background check ~30s after launch.
 * 2. Renderer can force a check via `checkForUpdates(true)`.
 * 3. When an update is downloaded, the renderer shows a confirmation dialog
 *    (triggered by the `update.state` event with status `"downloaded"`).
 * 4. `quitAndInstall()` restarts the app and applies the update.
 *
 * Auth: electron-updater reads `GH_TOKEN` from the environment or the embedded
 * `app-update.yml` token field at build time for private repos.
 */

const INITIAL_CHECK_DELAY_MS = 30_000;

let initialized = false;
let lastState: UpdateState = {
  status: "idle",
  currentVersion: "",
  availableVersion: null,
  releaseNotes: null,
  releaseDate: null,
  progress: null,
  error: null,
  lastCheckedAt: null
};

function broadcast(state: UpdateState): void {
  lastState = state;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("update:state", state);
    }
  }
}

function patch(partial: Partial<UpdateState>): void {
  broadcast({ ...lastState, ...partial });
}

function releaseNotesToString(notes: UpdateInfo["releaseNotes"]): string | null {
  if (!notes) return null;
  if (typeof notes === "string") return notes;
  if (Array.isArray(notes)) {
    return notes.map((n) => n.note ?? "").filter(Boolean).join("\n\n") || null;
  }
  return null;
}

export function initUpdater(): void {
  if (initialized) return;
  initialized = true;

  lastState = { ...lastState, currentVersion: app.getVersion() };

  // In dev mode there is no packaged app and no app-update.yml, so skip.
  if (!app.isPackaged) {
    log.info("[updater] skipping init in dev mode");
    return;
  }

  // logger transports are configured centrally in initLogger().
  autoUpdater.logger = electronLog;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    patch({ status: "checking", error: null, lastCheckedAt: new Date().toISOString() });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    patch({
      status: "available",
      availableVersion: info.version,
      releaseNotes: releaseNotesToString(info.releaseNotes),
      releaseDate: info.releaseDate ?? null,
      error: null
    });
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    patch({
      status: "not-available",
      availableVersion: info.version,
      releaseNotes: null,
      releaseDate: info.releaseDate ?? null,
      progress: null,
      error: null
    });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    patch({
      status: "downloading",
      progress: {
        bytesPerSecond: progress.bytesPerSecond,
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total
      }
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    patch({
      status: "downloaded",
      availableVersion: info.version,
      releaseNotes: releaseNotesToString(info.releaseNotes),
      releaseDate: info.releaseDate ?? null,
      progress: null,
      error: null
    });
  });

  autoUpdater.on("error", (err) => {
    patch({
      status: "error",
      error: err instanceof Error ? err.message : String(err)
    });
  });

  // Silent background check shortly after launch.
  setTimeout(() => {
    void checkForUpdates(false);
  }, INITIAL_CHECK_DELAY_MS);
}

export async function checkForUpdates(userInitiated: boolean): Promise<UpdateState> {
  if (!app.isPackaged) {
    const state: UpdateState = {
      ...lastState,
      status: "not-available",
      lastCheckedAt: new Date().toISOString()
    };
    broadcast(state);
    return state;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    log.error("[updater] check failed", err);
    patch({
      status: "error",
      error: err instanceof Error ? err.message : String(err)
    });
  }
  // Touch lastCheckedAt only on explicit user checks so silent checks stay
  // invisible until something changes.
  if (userInitiated) {
    patch({ lastCheckedAt: new Date().toISOString() });
  }
  return lastState;
}

export function quitAndInstall(): void {
  if (!app.isPackaged) {
    log.warn("[updater] quitAndInstall ignored in dev mode");
    return;
  }
  // isSilent=false, forceRunAfter=true → show installer UI, relaunch after.
  autoUpdater.quitAndInstall(false, true);
}

export function getUpdateState(): UpdateState {
  return lastState;
}
