import { eq } from "drizzle-orm";
import type {
  Integration,
  IntegrationStatus,
  IntegrationType
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { integrations } from "../schema.js";

function rowToIntegration(row: typeof integrations.$inferSelect): Integration {
  return {
    id: row.id,
    templateId: row.templateId ?? null,
    name: row.name,
    displayName: row.displayName && row.displayName.length > 0 ? row.displayName : row.name,
    type: row.type as IntegrationType,
    status: row.status as IntegrationStatus,
    config: JSON.parse(row.config) as Record<string, unknown>,
    lastCheckedAt: row.lastCheckedAt ?? null,
    lastSyncAt: row.lastSyncAt ?? null,
    lastSyncError: row.lastSyncError ?? null,
    syncIntervalSec: row.syncIntervalSec ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export interface UpsertIntegrationInput {
  id: string;
  name: string;
  type: IntegrationType;
  templateId?: string | null;
  displayName?: string;
  status?: IntegrationStatus;
  config?: Record<string, unknown>;
  syncIntervalSec?: number | null;
}

export async function listIntegrations(db: ElevatorDb): Promise<Integration[]> {
  const rows = await db.select().from(integrations);
  return rows.map(rowToIntegration);
}

export async function getIntegration(
  db: ElevatorDb,
  id: string
): Promise<Integration | null> {
  const rows = await db.select().from(integrations).where(eq(integrations.id, id));
  return rows[0] ? rowToIntegration(rows[0]) : null;
}

export async function upsertIntegration(
  db: ElevatorDb,
  input: UpsertIntegrationInput
): Promise<Integration> {
  const now = new Date();
  const existing = await getIntegration(db, input.id);
  if (existing) {
    const patch: Partial<typeof integrations.$inferInsert> = {
      name: input.name,
      type: input.type,
      updatedAt: now
    };
    if (input.templateId !== undefined) patch.templateId = input.templateId;
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.status !== undefined) patch.status = input.status;
    if (input.config !== undefined) patch.config = JSON.stringify(input.config);
    if (input.syncIntervalSec !== undefined) patch.syncIntervalSec = input.syncIntervalSec;
    await db.update(integrations).set(patch).where(eq(integrations.id, input.id));
    const updated = await getIntegration(db, input.id);
    if (!updated) throw new Error(`Integration ${input.id} disappeared during upsert`);
    return updated;
  }

  const row = {
    id: input.id,
    templateId: input.templateId ?? null,
    name: input.name,
    displayName: input.displayName ?? input.name,
    type: input.type,
    status: input.status ?? "disconnected",
    config: JSON.stringify(input.config ?? {}),
    lastCheckedAt: null,
    lastSyncAt: null,
    lastSyncError: null,
    syncIntervalSec: input.syncIntervalSec ?? null,
    createdAt: now,
    updatedAt: now
  };
  await db.insert(integrations).values(row);
  return rowToIntegration(row);
}

export async function setIntegrationStatus(
  db: ElevatorDb,
  id: string,
  status: IntegrationStatus,
  lastCheckedAt: Date | null = new Date()
): Promise<Integration | null> {
  await db
    .update(integrations)
    .set({ status, lastCheckedAt, updatedAt: new Date() })
    .where(eq(integrations.id, id));
  return getIntegration(db, id);
}

export async function setIntegrationConfig(
  db: ElevatorDb,
  id: string,
  config: Record<string, unknown>
): Promise<Integration | null> {
  await db
    .update(integrations)
    .set({ config: JSON.stringify(config), updatedAt: new Date() })
    .where(eq(integrations.id, id));
  return getIntegration(db, id);
}

export async function setIntegrationSync(
  db: ElevatorDb,
  id: string,
  lastSyncAt: Date | null,
  lastSyncError: string | null
): Promise<Integration | null> {
  await db
    .update(integrations)
    .set({ lastSyncAt, lastSyncError, updatedAt: new Date() })
    .where(eq(integrations.id, id));
  return getIntegration(db, id);
}

export async function deleteIntegration(db: ElevatorDb, id: string): Promise<void> {
  await db.delete(integrations).where(eq(integrations.id, id));
}
