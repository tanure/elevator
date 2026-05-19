import { getPendingJobs, resetStuckJobs, updateJobStatus } from "@elevator/data";
import { getDb } from "./db.js";
import { eventBus } from "./event-bus.js";

type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function startScheduler(): () => void {
  const db = getDb();

  // Recover any jobs that were left in 'running' state from a previous crash
  void resetStuckJobs(db);

  const interval = setInterval(() => {
    void runTick();
  }, 5000);

  return () => {
    clearInterval(interval);
  };
}

async function runTick(): Promise<void> {
  const db = getDb();
  const now = new Date();
  const pending = await getPendingJobs(db, now);

  for (const job of pending) {
    // Mark running
    await updateJobStatus(db, job.id, "running", { startedAt: now });

    try {
      const handler = handlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: "${job.type}"`);
      }
      await handler(job.payload);

      await updateJobStatus(db, job.id, "completed", { completedAt: new Date() });
      eventBus.emit("job.completed", { id: job.id, type: job.type });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const newRetries = job.retries + 1;

      if (newRetries >= job.maxRetries) {
        await updateJobStatus(db, job.id, "failed", {
          failedAt: new Date(),
          error,
          retries: newRetries
        });
        eventBus.emit("job.failed", { id: job.id, type: job.type, error });
      } else {
        // Exponential backoff: 2^retries seconds
        const backoffMs = Math.pow(2, newRetries) * 1000;
        const nextScheduledAt = new Date(Date.now() + backoffMs);
        await updateJobStatus(db, job.id, "pending", {
          retries: newRetries,
          scheduledAt: nextScheduledAt
        });
      }
    }
  }
}
