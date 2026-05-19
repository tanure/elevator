import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = `release-dev-${timestamp}`;
const command = process.execPath;
const args = [
  fileURLToPath(new URL("../node_modules/electron-builder/cli.js", import.meta.url)),
  "--dir",
  `--config.directories.output=${outputDirectory}`
];

const result = spawnSync(command, args, {
  cwd: fileURLToPath(new URL("../apps/desktop", import.meta.url)),
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Packaged Elevator desktop app to apps/desktop/${outputDirectory}/win-unpacked`);
