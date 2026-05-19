import { randomUUID } from "node:crypto";
import type {
  ConnectorTemplate,
  CreateIntegrationInstanceInput,
  Integration,
  IntegrationMutationResult,
  ToolDescriptor,
  UpdateIntegrationInstanceInput
} from "@elevator/shared";
import {
  deleteIntegration,
  getIntegration,
  listIntegrations,
  setIntegrationStatus,
  setIntegrationSync,
  upsertIntegration
} from "@elevator/data";
import { getDb } from "../db.js";
import { eventBus } from "../event-bus.js";
import {
  deleteAllSecretsForInstance,
  deleteSecret,
  getSecret,
  setSecret
} from "../secrets.js";
import { cliModule } from "./connectors/cli.js";
import { workIqModule } from "./connectors/workiq.js";
import { icsModule } from "./connectors/ics.js";
import { httpReportModule } from "./connectors/http-report.js";
import { m365CalendarModule } from "./connectors/m365-calendar.js";
import { m365MailModule } from "./connectors/m365-mail.js";
import type { Connector, ConnectorContext, ConnectorModule } from "./types.js";
import { validateConfig } from "./validation.js";
import { clearCache, getSyncCache } from "./cache.js";
import type { IntegrationSyncData } from "@elevator/shared";

const SECRET_REF = { secretRef: true } as const;

interface RegisteredModule {
  template: ConnectorTemplate;
  connector: Connector;
}

const modules = new Map<string, RegisteredModule>();

function registerModule(mod: ConnectorModule): void {
  modules.set(mod.template.id, { template: mod.template, connector: mod.connector });
}

export function getTemplate(templateId: string): ConnectorTemplate | undefined {
  return modules.get(templateId)?.template;
}

export function listTemplates(): ConnectorTemplate[] {
  return [...modules.values()].map((m) => m.template);
}

export async function ensureRegistered(): Promise<void> {
  if (modules.size === 0) {
    registerModule(cliModule);
    registerModule(workIqModule);
    registerModule(icsModule);
    registerModule(httpReportModule);
    registerModule(m365CalendarModule);
    registerModule(m365MailModule);
  }
}

/**
 * Build the runtime config a connector sees: non-secret values come straight
 * from the row, secret values are decrypted from the OS credential vault.
 */
async function resolveRuntimeConfig(
  instance: Integration
): Promise<Record<string, unknown>> {
  const tpl = modules.get(instance.templateId ?? instance.name)?.template;
  const out: Record<string, unknown> = { ...instance.config };
  if (!tpl) return out;
  for (const field of tpl.configSchema) {
    if (field.type !== "secret") continue;
    const secret = await getSecret(instance.id, field.key);
    if (secret !== null) out[field.key] = secret;
    else delete out[field.key];
  }
  return out;
}

function moduleForInstance(instance: Integration): RegisteredModule | undefined {
  return modules.get(instance.templateId ?? instance.name);
}

export async function listAllTools(): Promise<ToolDescriptor[]> {
  const db = getDb();
  const instances = await listIntegrations(db);
  const tools: ToolDescriptor[] = [];
  for (const inst of instances) {
    const mod = moduleForInstance(inst);
    if (!mod) continue;
    const cfg = await resolveRuntimeConfig(inst);
    const ctx: ConnectorContext = { instanceId: inst.id, config: cfg };
    for (const t of mod.connector.listTools(ctx)) {
      tools.push({ ...t, integrationId: inst.id });
    }
  }
  return tools;
}

/**
 * Split a submitted config into the part safe to store in the DB (with
 * `secretRef` markers replacing secret values) and the secret values that
 * must be written to the credential vault.
 */
function splitSecrets(
  template: ConnectorTemplate,
  input: Record<string, unknown>
): { stored: Record<string, unknown>; secrets: Record<string, string> } {
  const stored: Record<string, unknown> = {};
  const secrets: Record<string, string> = {};
  const fields = new Map(template.configSchema.map((f) => [f.key, f] as const));
  for (const [key, value] of Object.entries(input)) {
    const field = fields.get(key);
    if (field?.type === "secret") {
      if (typeof value === "string" && value.length > 0) {
        secrets[key] = value;
        stored[key] = SECRET_REF;
      } else if (value && typeof value === "object" && (value as { secretRef?: boolean }).secretRef) {
        // Keep existing secret reference (UI didn't submit a new value).
        stored[key] = SECRET_REF;
      }
      // Empty secret on an optional field → drop entirely.
    } else {
      stored[key] = value;
    }
  }
  return { stored, secrets };
}

export async function createInstance(
  input: CreateIntegrationInstanceInput
): Promise<IntegrationMutationResult> {
  const mod = modules.get(input.templateId);
  if (!mod) return { ok: false, message: `Unknown template: ${input.templateId}` };

  // Reject duplicates for single-instance templates.
  if (!mod.template.supportsMultipleInstances) {
    const existing = await listIntegrations(getDb());
    if (existing.some((i) => (i.templateId ?? i.name) === mod.template.id)) {
      return {
        ok: false,
        message: `${mod.template.name} only supports a single instance.`
      };
    }
  }

  const errors = validateConfig(mod.template.configSchema, input.config);
  if (errors.length > 0) return { ok: false, errors };

  const { stored, secrets } = splitSecrets(mod.template, input.config);
  const id = randomUUID();

  // Persist secrets first; if that fails we never write a row.
  try {
    for (const [key, value] of Object.entries(secrets)) {
      await setSecret(id, key, value);
    }
  } catch (err) {
    await deleteAllSecretsForInstance(id).catch(() => undefined);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to store credentials."
    };
  }

  const integration = await upsertIntegration(getDb(), {
    id,
    templateId: mod.template.id,
    name: mod.template.id,
    displayName: input.displayName.trim() || mod.template.name,
    type: mod.template.type,
    status: "disconnected",
    config: stored,
    syncIntervalSec: input.syncIntervalSec ?? null
  });

  eventBus.emit("integration.created", { id });
  return { ok: true, integration };
}

export async function updateInstance(
  id: string,
  input: UpdateIntegrationInstanceInput
): Promise<IntegrationMutationResult> {
  const db = getDb();
  const existing = await getIntegration(db, id);
  if (!existing) return { ok: false, message: `Integration ${id} not found.` };
  const mod = moduleForInstance(existing);
  if (!mod) return { ok: false, message: `No template registered for ${id}.` };

  let nextConfig = existing.config;
  if (input.config) {
    const errors = validateConfig(mod.template.configSchema, input.config);
    if (errors.length > 0) return { ok: false, errors };
    const { stored, secrets } = splitSecrets(mod.template, input.config);
    try {
      for (const field of mod.template.configSchema) {
        if (field.type !== "secret") continue;
        if (Object.prototype.hasOwnProperty.call(secrets, field.key)) {
          await setSecret(id, field.key, secrets[field.key]);
        } else if (!stored[field.key]) {
          // Secret was cleared by the user → drop it from the vault too.
          await deleteSecret(id, field.key);
        }
      }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Failed to update credentials."
      };
    }
    nextConfig = stored;
  }

  const integration = await upsertIntegration(db, {
    id,
    templateId: existing.templateId ?? mod.template.id,
    name: existing.name,
    displayName: input.displayName?.trim() || existing.displayName,
    type: existing.type,
    status: existing.status,
    config: nextConfig,
    syncIntervalSec: input.syncIntervalSec ?? existing.syncIntervalSec ?? null
  });
  return { ok: true, integration };
}

export async function deleteInstance(id: string): Promise<void> {
  const db = getDb();
  await deleteIntegration(db, id);
  await deleteAllSecretsForInstance(id);
  await clearCache(id).catch(() => undefined);
  eventBus.emit("integration.deleted", { id });
}

export async function runHealthCheck(
  id: string
): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  const integration = await getIntegration(db, id);
  if (!integration) return { ok: false, message: `Unknown integration: ${id}` };
  const mod = moduleForInstance(integration);
  if (!mod) return { ok: false, message: `No template registered for ${integration.name}.` };
  const config = await resolveRuntimeConfig(integration);
  try {
    const result = await mod.connector.check({ instanceId: id, config });
    await setIntegrationStatus(db, id, result.ok ? "connected" : "error");
    if (result.ok) eventBus.emit("integration.connected", { id });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setIntegrationStatus(db, id, "error");
    return { ok: false, message };
  }
}

export async function connectIntegration(
  id: string
): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  const integration = await getIntegration(db, id);
  if (!integration) return { ok: false, message: `Unknown integration: ${id}` };
  const mod = moduleForInstance(integration);
  if (!mod) return { ok: false, message: `No template registered for ${integration.name}.` };
  // Connectors with a custom connect flow (e.g. OAuth) run it first; others
  // fall back to a plain health check.
  if (typeof mod.connector.connect === "function") {
    const config = await resolveRuntimeConfig(integration);
    try {
      const result = await mod.connector.connect({ instanceId: id, config });
      await setIntegrationStatus(db, id, result.ok ? "connected" : "error");
      if (result.ok) eventBus.emit("integration.connected", { id });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await setIntegrationStatus(db, id, "error");
      return { ok: false, message };
    }
  }
  return runHealthCheck(id);
}

export async function disconnectIntegration(id: string): Promise<void> {
  const db = getDb();
  await setIntegrationStatus(db, id, "disconnected");
  eventBus.emit("integration.disconnected", { id });
}

/**
 * Test a not-yet-persisted configuration. Decrypts any existing secrets by
 * instance id (when editing), otherwise uses the values the user just typed.
 */
export async function testInstance(
  templateId: string,
  config: Record<string, unknown>,
  existingInstanceId?: string
): Promise<{ ok: boolean; message: string; errors?: { field: string; message: string }[] }> {
  const mod = modules.get(templateId);
  if (!mod) return { ok: false, message: `Unknown template: ${templateId}` };
  const errors = validateConfig(mod.template.configSchema, config);
  if (errors.length > 0) return { ok: false, message: "Invalid configuration.", errors };

  // Resolve secret fields from existing instance when the user didn't retype.
  const runtime: Record<string, unknown> = { ...config };
  for (const field of mod.template.configSchema) {
    if (field.type !== "secret") continue;
    const supplied = config[field.key];
    if (typeof supplied === "string" && supplied.length > 0) continue;
    if (existingInstanceId) {
      const secret = await getSecret(existingInstanceId, field.key);
      if (secret) runtime[field.key] = secret;
    }
  }
  try {
    return await mod.connector.check({
      instanceId: existingInstanceId ?? "preview",
      config: runtime
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function callConnectorTool(
  instanceId: string,
  toolId: string,
  input: Record<string, unknown>
): Promise<{ ok: boolean; output: unknown; error?: string }> {
  const db = getDb();
  const integration = await getIntegration(db, instanceId);
  if (!integration) {
    return { ok: false, output: null, error: `Unknown integration: ${instanceId}` };
  }
  const mod = moduleForInstance(integration);
  if (!mod) {
    return {
      ok: false,
      output: null,
      error: `No template registered for ${integration.name}`
    };
  }
  const config = await resolveRuntimeConfig(integration);
  return mod.connector.callTool({ instanceId, config }, toolId, input);
}

export async function syncInstance(id: string): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  const integration = await getIntegration(db, id);
  if (!integration) return { ok: false, message: `Unknown integration: ${id}` };
  const mod = moduleForInstance(integration);
  if (!mod) return { ok: false, message: `No template registered for ${integration.name}.` };
  const config = await resolveRuntimeConfig(integration);
  // Connectors that implement `sync` produce real data (events/mail/report);
  // others reuse the health check so the UI timestamps still update.
  if (typeof mod.connector.sync === "function") {
    try {
      await mod.connector.sync({ instanceId: id, config });
      await setIntegrationSync(db, id, new Date(), null);
      await setIntegrationStatus(db, id, "connected");
      eventBus.emit("integration.synced", { id, ok: true });
      return { ok: true, message: "Synced." };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await setIntegrationSync(db, id, new Date(), message);
      await setIntegrationStatus(db, id, "error");
      eventBus.emit("integration.synced", { id, ok: false });
      return { ok: false, message };
    }
  }
  const result = await runHealthCheck(id);
  await setIntegrationSync(db, id, new Date(), result.ok ? null : result.message);
  eventBus.emit("integration.synced", { id, ok: result.ok });
  return result;
}

export async function getSyncData(id: string): Promise<IntegrationSyncData | null> {
  return getSyncCache(id);
}
