import type { ElevatorDb } from "./db.js";
import { listNotes } from "./repositories/notes.js";
import { listTasks } from "./repositories/tasks.js";
import { listIntegrations } from "./repositories/integrations.js";
import { listJobs } from "./repositories/jobs.js";
import { getAllSettings } from "./repositories/settings.js";
import { listAuditLog } from "./repositories/audit.js";
import { listAgentRuns } from "./repositories/agentRuns.js";

/**
 * Export every user-owned table as a single JSON-serialisable object.
 * Used by the diagnostics/backup flow. Secrets are NOT scrubbed here —
 * callers that produce shareable backups should pass `redactSecrets: true`.
 */
export interface ExportSnapshot {
  exportedAt: string;
  schemaVersion: number;
  notes: unknown[];
  tasks: unknown[];
  integrations: unknown[];
  jobs: unknown[];
  settings: Record<string, string>;
  auditLog: unknown[];
  agentRuns: unknown[];
}

export interface ExportAllOptions {
  redactSecrets?: boolean;
  schemaVersion?: number;
}

const SECRET_KEY_PATTERN = /(token|secret|key|password|credential|authorization)/i;

function redactSecretsInRecord<T extends Record<string, unknown>>(record: T): T {
  const out: Record<string, unknown> = { ...record };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (SECRET_KEY_PATTERN.test(key)) {
      out[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactSecretsInRecord(value as Record<string, unknown>);
    }
  }
  return out as T;
}

export async function exportAll(
  db: ElevatorDb,
  opts: ExportAllOptions = {}
): Promise<ExportSnapshot> {
  const [notes, tasks, integrations, jobs, settings, auditLog, agentRuns] = await Promise.all([
    listNotes(db),
    listTasks(db),
    listIntegrations(db),
    listJobs(db),
    getAllSettings(db),
    listAuditLog(db, { limit: 5000 }),
    listAgentRuns(db, { limit: 1000 })
  ]);

  const integrationsOut = opts.redactSecrets
    ? integrations.map((i) => {
        const copy = { ...i } as Record<string, unknown>;
        if (copy.config && typeof copy.config === "object") {
          copy.config = redactSecretsInRecord(copy.config as Record<string, unknown>);
        }
        return copy;
      })
    : integrations;

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: opts.schemaVersion ?? 1,
    notes,
    tasks,
    integrations: integrationsOut,
    jobs,
    settings,
    auditLog,
    agentRuns
  };
}
