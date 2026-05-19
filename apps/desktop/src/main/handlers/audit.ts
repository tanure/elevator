import { ipcMain } from "electron";
import { listAuditLog } from "@elevator/data";
import type { AuditLogEntry } from "@elevator/shared";
import { getDb } from "../db.js";

export function registerAuditHandlers(): void {
  ipcMain.handle(
    "audit:list",
    async (_event, opts?: { limit?: number; offset?: number }): Promise<AuditLogEntry[]> => {
      return listAuditLog(getDb(), opts);
    }
  );
}
