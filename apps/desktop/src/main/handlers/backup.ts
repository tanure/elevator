import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { copyFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exportAll } from "@elevator/data";
import type { BackupResult } from "@elevator/shared";
import { getDb } from "../db.js";
import { createLogger } from "../logger.js";

const log = createLogger("backup");

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function dbFilePath(): string {
  return join(app.getPath("userData"), "elevator.db");
}

export function registerBackupHandlers(): void {
  ipcMain.handle("backup:exportDatabase", async (): Promise<BackupResult | null> => {
    const focused = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
    const defaultPath = `elevator-backup-${timestamp()}.db`;
    const opts = {
      title: "Export Elevator database",
      defaultPath,
      filters: [{ name: "SQLite database", extensions: ["db"] }]
    };
    const res = focused
      ? await dialog.showSaveDialog(focused, opts)
      : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return null;

    await copyFile(dbFilePath(), res.filePath);
    const s = await stat(res.filePath);
    log.info("database exported", { filePath: res.filePath, bytes: s.size });
    return { filePath: res.filePath, bytes: s.size };
  });

  ipcMain.handle("backup:exportJson", async (): Promise<BackupResult | null> => {
    const focused = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
    const defaultPath = `elevator-backup-${timestamp()}.json`;
    const opts = {
      title: "Export Elevator data as JSON",
      defaultPath,
      filters: [{ name: "JSON", extensions: ["json"] }]
    };
    const res = focused
      ? await dialog.showSaveDialog(focused, opts)
      : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return null;

    const snapshot = await exportAll(getDb(), { redactSecrets: true });
    const json = JSON.stringify(snapshot, null, 2);
    await writeFile(res.filePath, json, "utf8");
    const s = await stat(res.filePath);
    log.info("json export written", { filePath: res.filePath, bytes: s.size });
    return { filePath: res.filePath, bytes: s.size };
  });
}
