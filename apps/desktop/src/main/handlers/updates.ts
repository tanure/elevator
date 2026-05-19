import { ipcMain } from "electron";
import type { UpdateState } from "@elevator/shared";
import { checkForUpdates, getUpdateState, quitAndInstall } from "../updater.js";

export function registerUpdateHandlers(): void {
  ipcMain.handle("updates:getState", (): UpdateState => getUpdateState());

  ipcMain.handle(
    "updates:check",
    (_event, userInitiated: boolean = true): Promise<UpdateState> =>
      checkForUpdates(userInitiated)
  );

  ipcMain.handle("updates:install", (): void => {
    quitAndInstall();
  });
}
