import { app, BrowserWindow, dialog, globalShortcut, ipcMain, shell } from "electron";
import { join } from "node:path";
import type { AppInfo } from "@elevator/shared";
import { initDb } from "./db.js";
import { startScheduler } from "./scheduler.js";
import {
  registerAgentTickHandler,
  scheduleAgentTicks
} from "./ai/agent-ticks.js";
import { registerSettingsHandlers } from "./handlers/settings.js";
import { registerNoteHandlers } from "./handlers/notes.js";
import { registerTaskHandlers } from "./handlers/tasks.js";
import { registerAuditHandlers } from "./handlers/audit.js";
import { registerJobHandlers } from "./handlers/jobs.js";
import { registerIntegrationHandlers } from "./handlers/integrations.js";
import { registerAgentHandlers } from "./handlers/agents.js";
import { registerChatHandlers } from "./handlers/chat.js";
import { registerCopilotHandlers } from "./handlers/copilot.js";
import { registerUpdateHandlers } from "./handlers/updates.js";
import { registerAppHandlers } from "./handlers/app.js";
import { registerDiagnosticsHandlers } from "./handlers/diagnostics.js";
import { registerBackupHandlers } from "./handlers/backup.js";
import { registerDashboardLayoutHandlers } from "./handlers/dashboardLayouts.js";
import { registerExtensionHandlers } from "./handlers/extensions.js";
import { registerViewHandlers } from "./handlers/views.js";
import { ensureRegistered as ensureIntegrationsRegistered } from "./integrations/registry.js";
import { ensureProvidersRegistered } from "./ai/registry.js";
import { hasCopilotToken } from "./ai/copilot-token.js";
import { setActiveProvider } from "./ai/registry.js";
import { shutdownCopilotProvider } from "./ai/copilot-provider.js";
import { ensureBuiltInSkillsRegistered } from "./ai/skills.js";
import { initUpdater } from "./updater.js";
import { initLogger, createLogger } from "./logger.js";

initLogger();
const log = createLogger("main");

let fatalDialogShown = false;
function showFatalErrorOnce(err: unknown): void {
  if (fatalDialogShown) return;
  fatalDialogShown = true;
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  try {
    dialog.showErrorBox(
      "Elevator encountered a fatal error",
      `${message}\n\nA detailed log has been written. The app will now close.`
    );
  } catch {
    // dialog may not be available before app ready; nothing else to do.
  }
}

process.on("uncaughtException", (err) => {
  log.error("uncaughtException", err);
  showFatalErrorOnce(err);
  app.exit(1);
});

process.on("unhandledRejection", (reason) => {
  log.error("unhandledRejection", reason);
});

app.on("render-process-gone", (_event, webContents, details) => {
  log.error("render-process-gone", details);
  if (details.reason !== "clean-exit" && !webContents.isDestroyed()) {
    try {
      webContents.reload();
    } catch (err) {
      log.error("reload after render-process-gone failed", err);
    }
  }
});

app.on("child-process-gone", (_event, details) => {
  log.error("child-process-gone", details);
});

const rendererDevServerUrl = process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL;

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    title: "Elevator",
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (rendererDevServerUrl) {
    void mainWindow.loadURL(rendererDevServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
}

function registerIpcHandlers(): void {
  ipcMain.handle("app:getInfo", (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion()
  }));

  ipcMain.handle("shell:openExternal", (_event, url: string): Promise<void> => {
    return shell.openExternal(url);
  });

  registerSettingsHandlers();
  registerNoteHandlers();
  registerTaskHandlers();
  registerAuditHandlers();
  registerJobHandlers();
  registerIntegrationHandlers();
  registerAgentHandlers();
  registerChatHandlers();
  registerCopilotHandlers();
  registerUpdateHandlers();
  registerAppHandlers();
  registerDiagnosticsHandlers();
  registerBackupHandlers();
  registerDashboardLayoutHandlers();
  registerExtensionHandlers();
  registerViewHandlers();
}

app.whenReady().then(async () => {
  app.setName("Elevator");
  await initDb();
  ensureProvidersRegistered();
  // Default to Copilot when a token is configured; otherwise stay on echo.
  if (await hasCopilotToken()) {
    try {
      setActiveProvider("copilot");
    } catch {
      /* registry mismatch — keep default */
    }
  }
  await ensureBuiltInSkillsRegistered();
  await ensureIntegrationsRegistered();
  registerIpcHandlers();
  registerAgentTickHandler();
  startScheduler();
  await scheduleAgentTicks();
  createMainWindow();
  initUpdater();

  globalShortcut.register("CommandOrControl+K", () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.webContents.send("palette:open");
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  shutdownCopilotProvider().catch(() => {});
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

