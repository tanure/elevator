import { safeStorage } from "electron";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";

/**
 * Secret storage for integration credentials.
 *
 * Encrypts each value with Electron `safeStorage` (DPAPI on Windows, Keychain
 * on macOS, libsecret on Linux) and persists ciphertext to a JSON file inside
 * the user data folder. When `safeStorage` is unavailable the value is rejected
 * rather than written in plaintext — we never write a raw secret to disk.
 *
 * Keys are `${instanceId}:${fieldKey}` so each integration instance has its
 * own namespace and deletes cleanly when the instance is removed.
 */

interface SecretsFile {
  /** Map from "<instanceId>:<fieldKey>" to base64 ciphertext. */
  entries: Record<string, string>;
}

let cache: SecretsFile | null = null;

function secretsPath(): string {
  return join(app.getPath("userData"), "secrets.json");
}

async function load(): Promise<SecretsFile> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(secretsPath(), "utf8");
    const parsed = JSON.parse(raw) as SecretsFile;
    cache = { entries: parsed.entries ?? {} };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cache = { entries: {} };
    } else {
      throw err;
    }
  }
  return cache;
}

async function save(file: SecretsFile): Promise<void> {
  await fs.mkdir(dirname(secretsPath()), { recursive: true });
  await fs.writeFile(secretsPath(), JSON.stringify(file), { encoding: "utf8", mode: 0o600 });
  cache = file;
}

function fullKey(instanceId: string, fieldKey: string): string {
  return `${instanceId}:${fieldKey}`;
}

export function isSecretStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

export async function setSecret(
  instanceId: string,
  fieldKey: string,
  value: string
): Promise<void> {
  if (!isSecretStorageAvailable()) {
    throw new Error(
      "OS secret storage unavailable; refusing to persist credential in plaintext."
    );
  }
  const file = await load();
  const cipher = safeStorage.encryptString(value);
  file.entries[fullKey(instanceId, fieldKey)] = cipher.toString("base64");
  await save(file);
}

export async function getSecret(
  instanceId: string,
  fieldKey: string
): Promise<string | null> {
  if (!isSecretStorageAvailable()) return null;
  const file = await load();
  const enc = file.entries[fullKey(instanceId, fieldKey)];
  if (!enc) return null;
  try {
    return safeStorage.decryptString(Buffer.from(enc, "base64"));
  } catch {
    return null;
  }
}

export async function deleteSecret(instanceId: string, fieldKey: string): Promise<void> {
  const file = await load();
  delete file.entries[fullKey(instanceId, fieldKey)];
  await save(file);
}

export async function deleteAllSecretsForInstance(instanceId: string): Promise<void> {
  const file = await load();
  const prefix = `${instanceId}:`;
  let changed = false;
  for (const k of Object.keys(file.entries)) {
    if (k.startsWith(prefix)) {
      delete file.entries[k];
      changed = true;
    }
  }
  if (changed) await save(file);
}

export async function listSecretKeys(instanceId: string): Promise<string[]> {
  const file = await load();
  const prefix = `${instanceId}:`;
  return Object.keys(file.entries)
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));
}
