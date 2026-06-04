import { asc, eq } from "drizzle-orm";
import type {
  CreateViewInput,
  UpdateViewInput,
  ViewRecord
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { views } from "../schema.js";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToView(row: typeof views.$inferSelect): ViewRecord {
  return {
    id: row.id,
    groupName: row.groupName,
    name: row.name,
    icon: row.icon,
    layoutId: row.layoutId ?? null,
    defaultChatSessionId: row.defaultChatSessionId ?? null,
    agentIds: parseJson<string[]>(row.agentIds, []),
    parameters: parseJson<Record<string, unknown>>(row.parameters, {}),
    templateId: row.templateId ?? null,
    chatInstructions: row.chatInstructions ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listViews(db: ElevatorDb): Promise<ViewRecord[]> {
  const rows = await db
    .select()
    .from(views)
    .orderBy(asc(views.groupName), asc(views.createdAt));
  return rows.map(rowToView);
}

export async function getView(
  db: ElevatorDb,
  id: string
): Promise<ViewRecord | null> {
  const rows = await db.select().from(views).where(eq(views.id, id));
  return rows[0] ? rowToView(rows[0]) : null;
}

export async function createView(
  db: ElevatorDb,
  id: string,
  input: CreateViewInput
): Promise<ViewRecord> {
  const now = new Date();
  await db.insert(views).values({
    id,
    groupName: input.groupName,
    name: input.name,
    icon: input.icon ?? "Folder",
    layoutId: input.layoutId ?? null,
    defaultChatSessionId: input.defaultChatSessionId ?? null,
    agentIds: JSON.stringify(input.agentIds ?? []),
    parameters: JSON.stringify(input.parameters ?? {}),
    templateId: input.templateId ?? null,
    chatInstructions: input.chatInstructions ?? "",
    createdAt: now,
    updatedAt: now
  });
  const found = await getView(db, id);
  if (!found) throw new Error("Insert failed for view");
  return found;
}

export async function updateView(
  db: ElevatorDb,
  id: string,
  input: UpdateViewInput
): Promise<ViewRecord | null> {
  const patch: Partial<typeof views.$inferInsert> = { updatedAt: new Date() };
  if (input.groupName !== undefined) patch.groupName = input.groupName;
  if (input.name !== undefined) patch.name = input.name;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.layoutId !== undefined) patch.layoutId = input.layoutId;
  if (input.defaultChatSessionId !== undefined)
    patch.defaultChatSessionId = input.defaultChatSessionId;
  if (input.agentIds !== undefined)
    patch.agentIds = JSON.stringify(input.agentIds);
  if (input.parameters !== undefined)
    patch.parameters = JSON.stringify(input.parameters);
  if (input.chatInstructions !== undefined)
    patch.chatInstructions = input.chatInstructions;
  await db.update(views).set(patch).where(eq(views.id, id));
  return getView(db, id);
}

export async function deleteView(db: ElevatorDb, id: string): Promise<void> {
  await db.delete(views).where(eq(views.id, id));
}
