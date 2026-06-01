import { and, asc, eq, isNull } from "drizzle-orm";
import type {
  CreateDashboardLayoutInput,
  DashboardLayout,
  DashboardSlot,
  UpdateDashboardLayoutInput
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { dashboardLayouts } from "../schema.js";

function parseSlots(value: string | null | undefined): DashboardSlot[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (slot): slot is DashboardSlot =>
          typeof slot === "object" &&
          slot !== null &&
          typeof (slot as DashboardSlot).cardId === "string"
      )
      .map((slot) => ({
        cardId: slot.cardId,
        colSpan: slot.colSpan === 2 ? 2 : 1
      }));
  } catch {
    return [];
  }
}

function rowToLayout(row: typeof dashboardLayouts.$inferSelect): DashboardLayout {
  return {
    id: row.id,
    name: row.name,
    viewId: row.viewId ?? null,
    isActive: row.isActive,
    slots: parseSlots(row.layout),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listDashboardLayouts(
  db: ElevatorDb
): Promise<DashboardLayout[]> {
  const rows = await db
    .select()
    .from(dashboardLayouts)
    .orderBy(asc(dashboardLayouts.createdAt));
  return rows.map(rowToLayout);
}

export async function getDashboardLayout(
  db: ElevatorDb,
  id: string
): Promise<DashboardLayout | null> {
  const rows = await db
    .select()
    .from(dashboardLayouts)
    .where(eq(dashboardLayouts.id, id));
  return rows[0] ? rowToLayout(rows[0]) : null;
}

/**
 * Return the active layout for a given view (or the global active layout
 * when `viewId` is null). Falls back to any layout matching the scope.
 */
export async function getActiveDashboardLayout(
  db: ElevatorDb,
  viewId: string | null = null
): Promise<DashboardLayout | null> {
  const scopeFilter =
    viewId === null
      ? isNull(dashboardLayouts.viewId)
      : eq(dashboardLayouts.viewId, viewId);

  const active = await db
    .select()
    .from(dashboardLayouts)
    .where(and(scopeFilter, eq(dashboardLayouts.isActive, true)));
  if (active[0]) return rowToLayout(active[0]);

  const any = await db
    .select()
    .from(dashboardLayouts)
    .where(scopeFilter)
    .orderBy(asc(dashboardLayouts.createdAt));
  return any[0] ? rowToLayout(any[0]) : null;
}

export async function createDashboardLayout(
  db: ElevatorDb,
  id: string,
  input: CreateDashboardLayoutInput
): Promise<DashboardLayout> {
  const now = new Date();
  await db.insert(dashboardLayouts).values({
    id,
    name: input.name,
    viewId: input.viewId ?? null,
    isActive: input.isActive ?? false,
    layout: JSON.stringify(input.slots ?? []),
    createdAt: now,
    updatedAt: now
  });
  const found = await getDashboardLayout(db, id);
  if (!found) throw new Error("Insert failed for dashboard layout");
  return found;
}

export async function updateDashboardLayout(
  db: ElevatorDb,
  id: string,
  input: UpdateDashboardLayoutInput
): Promise<DashboardLayout | null> {
  const patch: Partial<typeof dashboardLayouts.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.slots !== undefined) patch.layout = JSON.stringify(input.slots);
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  await db.update(dashboardLayouts).set(patch).where(eq(dashboardLayouts.id, id));
  return getDashboardLayout(db, id);
}

export async function deleteDashboardLayout(
  db: ElevatorDb,
  id: string
): Promise<void> {
  await db.delete(dashboardLayouts).where(eq(dashboardLayouts.id, id));
}

/**
 * Ensure exactly one layout exists for the given scope (`viewId` null →
 * the global dashboard). Returns the existing layout when present;
 * otherwise creates one seeded with `defaultSlots`. Always marked active.
 */
export async function ensureActiveLayout(
  db: ElevatorDb,
  newId: () => string,
  opts: {
    viewId: string | null;
    name: string;
    defaultSlots: DashboardSlot[];
  }
): Promise<DashboardLayout> {
  const existing = await getActiveDashboardLayout(db, opts.viewId);
  if (existing) return existing;
  return createDashboardLayout(db, newId(), {
    name: opts.name,
    viewId: opts.viewId,
    slots: opts.defaultSlots,
    isActive: true
  });
}
