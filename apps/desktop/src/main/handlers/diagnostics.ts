import { app, ipcMain, shell } from "electron";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { release, arch, platform } from "node:os";
import type { DiagnosticsSnapshot } from "@elevator/shared";
import { listIntegrations, listJobs } from "@elevator/data";
import { getDb } from "../db.js";
import { getLogsPath } from "../logger.js";

function dbFilePath(): string {
  return join(app.getPath("userData"), "elevator.db");
}

async function dbStats(): Promise<{ sizeBytes: number | null; lastModified: string | null }> {
  try {
    const s = await stat(dbFilePath());
    return { sizeBytes: s.size, lastModified: s.mtime.toISOString() };
  } catch {
    return { sizeBytes: null, lastModified: null };
  }
}

export function registerDiagnosticsHandlers(): void {
  ipcMain.handle("diagnostics:snapshot", async (): Promise<DiagnosticsSnapshot> => {
    const db = getDb();
    const [integrations, jobs, dbInfo] = await Promise.all([
      listIntegrations(db),
      listJobs(db),
      dbStats()
    ]);

    const pendingJobs = jobs.filter((j) => j.status === "pending").length;
    const runningJobs = jobs.filter((j) => j.status === "running").length;
    const failedJobs = jobs.filter((j) => j.status === "failed").length;

    return {
      app: { name: app.getName(), version: app.getVersion(), packaged: app.isPackaged },
      os: { platform: platform(), release: release(), arch: arch() },
      electron: {
        electron: process.versions.electron ?? "",
        chrome: process.versions.chrome ?? "",
        node: process.versions.node ?? ""
      },
      paths: {
        userData: app.getPath("userData"),
        dbPath: dbFilePath(),
        logsPath: getLogsPath()
      },
      db: dbInfo,
      integrations: integrations.map((i) => ({
        id: i.id,
        templateId: i.templateId ?? "",
        name: i.displayName ?? i.name,
        status: i.status,
        lastSyncedAt: i.lastSyncAt ? new Date(i.lastSyncAt).toISOString() : null
      })),
      scheduler: { pendingJobs, runningJobs, failedJobs },
      capturedAt: new Date().toISOString()
    };
  });

  ipcMain.handle("diagnostics:openLogs", async (): Promise<void> => {
    const result = await shell.openPath(getLogsPath());
    if (result) throw new Error(result);
  });

  ipcMain.handle("diagnostics:openDataFolder", async (): Promise<void> => {
    const result = await shell.openPath(app.getPath("userData"));
    if (result) throw new Error(result);
  });
}
