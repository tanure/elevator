import { ipcMain } from "electron";
import { getAllSettings, getSetting, setSetting } from "@elevator/data";
import { getDb } from "../db.js";
import { eventBus } from "../event-bus.js";

export function registerSettingsHandlers(): void {
  ipcMain.handle("settings:get", async (_event, key: string): Promise<string | null> => {
    return getSetting(getDb(), key);
  });

  ipcMain.handle("settings:set", async (_event, key: string, value: string): Promise<void> => {
    await setSetting(getDb(), key, value);
    eventBus.emit("settings.changed", { key, value });
  });

  ipcMain.handle("settings:getAll", async (): Promise<Record<string, string>> => {
    return getAllSettings(getDb());
  });
}
