import { app } from "electron";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createDb, seedBuiltInViewTemplates } from "@elevator/data";
import type { ElevatorDb } from "@elevator/data";

let db: ElevatorDb | null = null;

export function getDb(): ElevatorDb {
  if (!db) {
    throw new Error("Database has not been initialised. Call initDb() first.");
  }
  return db;
}

export async function initDb(): Promise<ElevatorDb> {
  const dbPath = `file:${join(app.getPath("userData"), "elevator.db")}`;
  db = await createDb(dbPath);
  await seedBuiltInViewTemplates(db, () => randomUUID());
  return db;
}
