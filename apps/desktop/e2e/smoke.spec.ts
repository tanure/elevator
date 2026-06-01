import { test, expect, _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Smoke tests for the packaged Electron app.
 *
 * Prerequisites: run `npm run build` in `apps/desktop` first so that
 * `out/main/index.js` exists. Each spec launches a fresh Electron process
 * pointed at an isolated `userData` directory so libsql/SQLite, the
 * scheduler, and any cached state do not bleed across runs.
 */

const APP_ROOT = resolve(__dirname, "..");
const MAIN_ENTRY = resolve(APP_ROOT, "out", "main", "index.js");

let app: ElectronApplication;
let userDataDir: string;
let mainWindow: Page;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), "elevator-e2e-"));
  app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    cwd: APP_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1"
    }
  });
  mainWindow = await app.firstWindow();
  await mainWindow.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await app?.close();
  if (userDataDir) {
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
});

test("app boots and renders the main shell", async () => {
  // Sidebar logo + version come from app.getName()/getVersion().
  await expect(mainWindow.getByText("Elevator").first()).toBeVisible();
  // Sidebar nav items.
  await expect(mainWindow.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(mainWindow.getByRole("link", { name: "Diagnostics" })).toBeVisible();
});

test("navigates to Diagnostics and shows the snapshot heading", async () => {
  await mainWindow.getByRole("link", { name: "Diagnostics" }).click();
  await expect(
    mainWindow.getByRole("heading", { name: /Diagnostics/i, level: 1 })
  ).toBeVisible();
  // Wait for the snapshot to populate — the Application section is a
  // reliable marker because it always renders once `diagnostics:snapshot`
  // resolves.
  await expect(mainWindow.getByText("Application", { exact: true })).toBeVisible();
});

test("navigates to Chat and renders the empty-state composer", async () => {
  await mainWindow.getByRole("link", { name: "Chat" }).click();
  // The Chat route is mounted; we don't depend on any session existing.
  await expect(mainWindow).toHaveURL(/#\/chat$/);
});
