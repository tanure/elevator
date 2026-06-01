import { defineConfig } from "@playwright/test";

/**
 * Playwright config for Elevator desktop smoke tests.
 *
 * The specs launch the packaged Electron entry point at `out/main/index.js`,
 * so `npm run build` must run first. Tests are intentionally minimal — they
 * verify the app boots, the shell renders, and a couple of key routes mount.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure"
  }
});
