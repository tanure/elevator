import { ipcMain } from "electron";
import { createLogger } from "../logger.js";

const log = createLogger("renderer");

export function registerAppHandlers(): void {
  ipcMain.handle(
    "app:logRendererError",
    (_event, message: string, stack: string): void => {
      log.error(message);
      if (stack) {
        log.error(stack);
      }
    }
  );
}
