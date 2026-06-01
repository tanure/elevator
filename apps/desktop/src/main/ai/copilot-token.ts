import { safeStorage } from "electron";
import { getSetting, setSetting } from "@elevator/data";
import { getDb } from "../db.js";

const TOKEN_KEY = "ai.copilot.token";
const MODEL_KEY = "ai.copilot.model";
const ENDPOINT_KEY = "ai.copilot.endpoint";

export const DEFAULT_COPILOT_MODEL = "gpt-5";
export const DEFAULT_COPILOT_ENDPOINT = "";

/**
 * Persist a copilot/BYOM API token. The token is encrypted with Electron's
 * `safeStorage` (OS keychain on macOS/Windows, libsecret/kwallet on Linux) and
 * stored in the settings table as a base64 blob. Throws if encryption is not
 * available on the platform.
 */
export async function setCopilotToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Token is empty");
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS encryption is not available; cannot store the Copilot token securely."
    );
  }
  const blob = safeStorage.encryptString(trimmed);
  await setSetting(getDb(), TOKEN_KEY, blob.toString("base64"));
}

export async function clearCopilotToken(): Promise<void> {
  await setSetting(getDb(), TOKEN_KEY, "");
}

/**
 * Read and decrypt the persisted token. Returns null if no token has been
 * stored or if decryption fails (e.g., keychain was reset).
 */
export async function getCopilotToken(): Promise<string | null> {
  const value = await getSetting(getDb(), TOKEN_KEY);
  if (!value) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const buf = Buffer.from(value, "base64");
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export async function hasCopilotToken(): Promise<boolean> {
  const value = await getSetting(getDb(), TOKEN_KEY);
  return !!value;
}

export async function getCopilotModel(): Promise<string> {
  const v = await getSetting(getDb(), MODEL_KEY);
  return v && v.trim() ? v.trim() : DEFAULT_COPILOT_MODEL;
}

export async function setCopilotModel(model: string): Promise<void> {
  await setSetting(getDb(), MODEL_KEY, model.trim());
}

export async function getCopilotEndpoint(): Promise<string> {
  const v = await getSetting(getDb(), ENDPOINT_KEY);
  return v && v.trim() ? v.trim() : DEFAULT_COPILOT_ENDPOINT;
}

export async function setCopilotEndpoint(endpoint: string): Promise<void> {
  await setSetting(getDb(), ENDPOINT_KEY, endpoint.trim());
}

export function encryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}
