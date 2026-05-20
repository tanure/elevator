import { app } from "electron";
import log, { type LogFunctions } from "electron-log";

/**
 * Centralised electron-log bootstrap.
 *
 * - File transport: `%APPDATA%\Elevator\logs\main.log`, rotated at 5 MB,
 *   keeps up to 3 archived files.
 * - Console transport: `debug` in dev, `warn` in packaged builds.
 * - `createLogger(scope)` returns a scoped logger that prefixes every line
 *   with `[scope]` so module ownership is obvious in the log file.
 */

let initialized = false;

export function initLogger(): void {
  if (initialized) return;
  initialized = true;

  log.transports.file.level = "info";
  log.transports.file.maxSize = 5 * 1024 * 1024;
  // electron-log keeps `${fileName}.old.log` automatically once maxSize is
  // hit; we additionally archive the previous one so we have ~3 generations.
  log.transports.file.archiveLogFn = (oldLogFile) => {
    try {
      const oldPath = oldLogFile.toString();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const archived = oldPath.replace(/\.log$/, `.${stamp}.log`);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("node:fs") as typeof import("node:fs");
      fs.renameSync(oldPath, archived);
    } catch {
      // best effort; never crash on archive failure
    }
  };

  log.transports.console.level = app.isPackaged ? "warn" : "debug";

  log.info("[logger] initialised", {
    logsPath: log.transports.file.getFile().path,
    packaged: app.isPackaged
  });
}

export function getLogsPath(): string {
  return log.transports.file.getFile().path;
}

export function createLogger(scope: string): LogFunctions {
  return log.scope(scope);
}

export { log };
