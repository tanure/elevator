import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { runMigrations } from "./migrate.js";
import * as schema from "./schema.js";

export async function createDb(url: string) {
  const client = createClient({ url });
  await runMigrations(client);
  return drizzle(client, { schema });
}

export type ElevatorDb = Awaited<ReturnType<typeof createDb>>;
