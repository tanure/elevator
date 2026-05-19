import { eq } from "drizzle-orm";
import type { ElevatorDb } from "../db.js";
import { settings } from "../schema.js";

export async function getSetting(db: ElevatorDb, key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  return rows[0]?.value ?? null;
}

export async function setSetting(db: ElevatorDb, key: string, value: string): Promise<void> {
  const now = new Date();
  await db
    .insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } });
}

export async function getAllSettings(db: ElevatorDb): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
