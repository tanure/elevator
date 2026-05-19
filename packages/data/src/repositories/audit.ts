import type { AuditLogEntry } from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { auditLog } from "../schema.js";
import { desc } from "drizzle-orm";

function rowToEntry(row: typeof auditLog.$inferSelect): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    actor: row.actor,
    action: row.action,
    target: row.target ?? null,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>
  };
}

export async function listAuditLog(
  db: ElevatorDb,
  opts: { limit?: number; offset?: number } = {}
): Promise<AuditLogEntry[]> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.timestamp))
    .limit(limit)
    .offset(offset);
  return rows.map(rowToEntry);
}

export async function appendAuditLog(
  db: ElevatorDb,
  actor: string,
  action: string,
  target?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(auditLog).values({
    timestamp: new Date(),
    actor,
    action,
    target: target ?? null,
    metadata: JSON.stringify(metadata ?? {})
  });
}
