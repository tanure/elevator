import { asc, eq } from "drizzle-orm";
import type {
  CreateSkillInput,
  SkillRecord,
  UpdateSkillInput
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { skills } from "../schema.js";

function rowToSkill(row: typeof skills.$inferSelect): SkillRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    systemPrompt: row.systemPrompt,
    promptTemplate: row.promptTemplate,
    inputVariables: safeJsonArray(row.inputVariables),
    allowedTools: safeJsonArray(row.allowedTools),
    isBuiltIn: row.isBuiltIn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function listSkills(db: ElevatorDb): Promise<SkillRecord[]> {
  const rows = await db.select().from(skills).orderBy(asc(skills.name));
  return rows.map(rowToSkill);
}

export async function getSkill(db: ElevatorDb, id: string): Promise<SkillRecord | null> {
  const rows = await db.select().from(skills).where(eq(skills.id, id));
  return rows[0] ? rowToSkill(rows[0]) : null;
}

export async function createSkill(
  db: ElevatorDb,
  input: CreateSkillInput & { id?: string }
): Promise<SkillRecord> {
  const now = new Date();
  const id = input.id ?? crypto.randomUUID();
  const row = {
    id,
    name: input.name,
    description: input.description ?? "",
    systemPrompt: input.systemPrompt ?? "",
    promptTemplate: input.promptTemplate ?? "",
    inputVariables: JSON.stringify(input.inputVariables ?? []),
    allowedTools: JSON.stringify(input.allowedTools ?? []),
    isBuiltIn: input.isBuiltIn ?? false,
    createdAt: now,
    updatedAt: now
  };
  await db.insert(skills).values(row);
  return rowToSkill(row);
}

export async function updateSkill(
  db: ElevatorDb,
  id: string,
  input: UpdateSkillInput
): Promise<SkillRecord | null> {
  const existing = await getSkill(db, id);
  if (!existing) return null;
  const patch: Partial<typeof skills.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.systemPrompt !== undefined) patch.systemPrompt = input.systemPrompt;
  if (input.promptTemplate !== undefined) patch.promptTemplate = input.promptTemplate;
  if (input.inputVariables !== undefined)
    patch.inputVariables = JSON.stringify(input.inputVariables);
  if (input.allowedTools !== undefined)
    patch.allowedTools = JSON.stringify(input.allowedTools);
  await db.update(skills).set(patch).where(eq(skills.id, id));
  return getSkill(db, id);
}

export async function deleteSkill(db: ElevatorDb, id: string): Promise<boolean> {
  const existing = await getSkill(db, id);
  if (!existing) return false;
  if (existing.isBuiltIn) {
    throw new Error("Cannot delete a built-in skill");
  }
  await db.delete(skills).where(eq(skills.id, id));
  return true;
}

export async function upsertBuiltInSkill(
  db: ElevatorDb,
  input: CreateSkillInput & { id: string }
): Promise<SkillRecord> {
  const existing = await getSkill(db, input.id);
  if (existing) {
    const updated = await updateSkill(db, input.id, {
      name: input.name,
      description: input.description,
      systemPrompt: input.systemPrompt,
      promptTemplate: input.promptTemplate,
      inputVariables: input.inputVariables,
      allowedTools: input.allowedTools
    });
    return updated ?? existing;
  }
  return createSkill(db, { ...input, isBuiltIn: true });
}
