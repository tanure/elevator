import { eq } from "drizzle-orm";
import type { Job, JobStatus } from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { jobQueue } from "../schema.js";

function rowToJob(row: typeof jobQueue.$inferSelect): Job {
  return {
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    status: row.status,
    scheduledAt: row.scheduledAt,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    failedAt: row.failedAt ?? null,
    error: row.error ?? null,
    retries: row.retries,
    maxRetries: row.maxRetries,
    createdAt: row.createdAt
  };
}

export async function listJobs(db: ElevatorDb): Promise<Job[]> {
  const rows = await db.select().from(jobQueue);
  return rows.map(rowToJob);
}

export async function enqueueJob(
  db: ElevatorDb,
  id: string,
  type: string,
  payload: Record<string, unknown>,
  scheduledAt: Date,
  maxRetries = 3
): Promise<Job> {
  const now = new Date();
  const row = {
    id,
    type,
    payload: JSON.stringify(payload),
    status: "pending" as const,
    scheduledAt,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    error: null,
    retries: 0,
    maxRetries,
    createdAt: now
  };
  await db.insert(jobQueue).values(row);
  return rowToJob(row);
}

export async function getPendingJobs(db: ElevatorDb, before: Date): Promise<Job[]> {
  const rows = await db.select().from(jobQueue);
  return rows
    .filter((r) => r.status === "pending" && r.scheduledAt <= before)
    .map(rowToJob);
}

export async function updateJobStatus(
  db: ElevatorDb,
  id: string,
  status: JobStatus,
  patch: {
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    error?: string;
    retries?: number;
    scheduledAt?: Date;
  } = {}
): Promise<void> {
  await db.update(jobQueue)
    .set({ status, ...patch })
    .where(eq(jobQueue.id, id));
}

export async function resetStuckJobs(db: ElevatorDb): Promise<void> {
  const rows = await db.select().from(jobQueue);
  const stuck = rows.filter((r) => r.status === "running");
  for (const row of stuck) {
    await db.update(jobQueue)
      .set({ status: "failed", error: "Process interrupted", failedAt: new Date() })
      .where(eq(jobQueue.id, row.id));
  }
}
