import { asc, eq } from "drizzle-orm";
import type {
  CreateViewTemplateInput,
  UpdateViewTemplateInput,
  ViewTemplate,
  ViewTemplateBody
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { viewTemplates } from "../schema.js";

function parseBody(value: string | null | undefined): ViewTemplateBody {
  const fallback: ViewTemplateBody = { groupName: "Views", slots: [], parameters: [] };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as Partial<ViewTemplateBody>;
    return {
      groupName: typeof parsed.groupName === "string" ? parsed.groupName : "Views",
      slots: Array.isArray(parsed.slots) ? parsed.slots : [],
      parameters: Array.isArray(parsed.parameters) ? parsed.parameters : [],
      agentIds: Array.isArray(parsed.agentIds) ? parsed.agentIds : undefined,
      icon: typeof parsed.icon === "string" ? parsed.icon : undefined
    };
  } catch {
    return fallback;
  }
}

function rowToTemplate(row: typeof viewTemplates.$inferSelect): ViewTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: parseBody(row.body),
    isBuiltIn: row.isBuiltIn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listViewTemplates(
  db: ElevatorDb
): Promise<ViewTemplate[]> {
  const rows = await db
    .select()
    .from(viewTemplates)
    .orderBy(asc(viewTemplates.createdAt));
  return rows.map(rowToTemplate);
}

export async function getViewTemplate(
  db: ElevatorDb,
  id: string
): Promise<ViewTemplate | null> {
  const rows = await db.select().from(viewTemplates).where(eq(viewTemplates.id, id));
  return rows[0] ? rowToTemplate(rows[0]) : null;
}

export async function createViewTemplate(
  db: ElevatorDb,
  id: string,
  input: CreateViewTemplateInput
): Promise<ViewTemplate> {
  const now = new Date();
  await db.insert(viewTemplates).values({
    id,
    name: input.name,
    description: input.description ?? "",
    body: JSON.stringify(input.body),
    isBuiltIn: input.isBuiltIn ?? false,
    createdAt: now,
    updatedAt: now
  });
  const found = await getViewTemplate(db, id);
  if (!found) throw new Error("Insert failed for view template");
  return found;
}

export async function updateViewTemplate(
  db: ElevatorDb,
  id: string,
  input: UpdateViewTemplateInput
): Promise<ViewTemplate | null> {
  const patch: Partial<typeof viewTemplates.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.body !== undefined) patch.body = JSON.stringify(input.body);
  await db.update(viewTemplates).set(patch).where(eq(viewTemplates.id, id));
  return getViewTemplate(db, id);
}

export async function deleteViewTemplate(
  db: ElevatorDb,
  id: string
): Promise<void> {
  await db.delete(viewTemplates).where(eq(viewTemplates.id, id));
}

/** Seed built-in templates idempotently. */
export async function seedBuiltInViewTemplates(
  db: ElevatorDb,
  newId: () => string
): Promise<void> {
  const all = await listViewTemplates(db);
  const haveCustomer = all.some(
    (tpl) => tpl.isBuiltIn && tpl.name === "Customer"
  );
  if (haveCustomer) return;

  const body: ViewTemplateBody = {
    groupName: "Customers",
    icon: "Users",
    parameters: [
      { name: "customerName", label: "Customer name", required: true },
      { name: "msxAccountId", label: "MSX account id" }
    ],
    slots: [
      { cardId: "view:filtered-notes", colSpan: 1 },
      { cardId: "view:filtered-tasks", colSpan: 1 },
      { cardId: "view:chat", colSpan: 2 }
    ]
  };

  await createViewTemplate(db, newId(), {
    name: "Customer",
    description:
      "A customer workspace with filtered notes & tasks plus a scoped chat.",
    body,
    isBuiltIn: true
  });
}
