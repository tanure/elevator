import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.execPath;
const args = [fileURLToPath(new URL("../node_modules/electron-vite/bin/electron-vite.js", import.meta.url)), "dev"];
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;

const result = spawnSync(command, args, {
  cwd: fileURLToPath(new URL("../apps/desktop", import.meta.url)),
  env,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
