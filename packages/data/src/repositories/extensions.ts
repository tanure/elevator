import { asc, eq } from "drizzle-orm";
import type {
  CreateExtensionInput,
  ExtensionRecord,
  UpdateExtensionInput
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { extensions } from "../schema.js";

function parseRenderHints(value: string | null | undefined): {
  colSpan?: 1 | 2;
} {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const hints = parsed as { colSpan?: unknown };
    const colSpan = hints.colSpan === 2 ? 2 : hints.colSpan === 1 ? 1 : undefined;
    return colSpan ? { colSpan } : {};
  } catch {
    return {};
  }
}

function rowToExtension(row: typeof extensions.$inferSelect): ExtensionRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    agentId: row.agentId ?? null,
    skillId: row.skillId ?? null,
    refreshSchedule: row.refreshSchedule,
    renderHints: parseRenderHints(row.renderHints),
    isEnabled: row.isEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listExtensions(db: ElevatorDb): Promise<ExtensionRecord[]> {
  const rows = await db.select().from(extensions).orderBy(asc(extensions.createdAt));
  return rows.map(rowToExtension);
}

export async function listEnabledCardExtensions(
  db: ElevatorDb
): Promise<ExtensionRecord[]> {
  const all = await listExtensions(db);
  return all.filter((ext) => ext.isEnabled && ext.kind === "card");
}

export async function getExtension(
  db: ElevatorDb,
  id: string
): Promise<ExtensionRecord | null> {
  const rows = await db.select().from(extensions).where(eq(extensions.id, id));
  return rows[0] ? rowToExtension(rows[0]) : null;
}

export async function createExtension(
  db: ElevatorDb,
  id: string,
  input: CreateExtensionInput
): Promise<ExtensionRecord> {
  const now = new Date();
  await db.insert(extensions).values({
    id,
    title: input.title,
    description: input.description ?? "",
    kind: "card",
    agentId: input.agentId ?? null,
    skillId: input.skillId ?? null,
    refreshSchedule: input.refreshSchedule ?? "",
    renderHints: JSON.stringify(input.renderHints ?? {}),
    isEnabled: input.isEnabled ?? true,
    createdAt: now,
    updatedAt: now
  });
  const found = await getExtension(db, id);
  if (!found) throw new Error("Insert failed for extension");
  return found;
}

export async function updateExtension(
  db: ElevatorDb,
  id: string,
  input: UpdateExtensionInput
): Promise<ExtensionRecord | null> {
  const patch: Partial<typeof extensions.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.agentId !== undefined) patch.agentId = input.agentId;
  if (input.skillId !== undefined) patch.skillId = input.skillId;
  if (input.refreshSchedule !== undefined) patch.refreshSchedule = input.refreshSchedule;
  if (input.renderHints !== undefined)
    patch.renderHints = JSON.stringify(input.renderHints);
  if (input.isEnabled !== undefined) patch.isEnabled = input.isEnabled;
  await db.update(extensions).set(patch).where(eq(extensions.id, id));
  return getExtension(db, id);
}

export async function deleteExtension(
  db: ElevatorDb,
  id: string
): Promise<void> {
  await db.delete(extensions).where(eq(extensions.id, id));
}
