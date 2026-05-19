import { ipcMain } from "electron";
import { listJobs } from "@elevator/data";
import type { Job } from "@elevator/shared";
import { getDb } from "../db.js";

export function registerJobHandlers(): void {
  ipcMain.handle("jobs:list", async (): Promise<Job[]> => {
    return listJobs(getDb());
  });
}
