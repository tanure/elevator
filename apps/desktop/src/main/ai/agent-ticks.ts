/**
 * Agent scheduling: turn an `AgentSchedule` into recurring `agent.tick` jobs.
 *
 * Flow:
 *   • At startup, `scheduleAgentTicks()` enqueues one pending tick for every
 *     agent whose `schedule.kind !== "none"` and that has no future tick
 *     already queued.
 *   • The scheduler invokes the `agent.tick` handler when due.
 *   • The handler runs the agent's goal once, then re-enqueues the next tick
 *     based on the live schedule.
 */
import { randomUUID } from "node:crypto";
import {
  appendAuditLog,
  enqueueJob,
  getAgent,
  listAgents,
  listJobs
} from "@elevator/data";
import type { AgentRecord, AgentSchedule } from "@elevator/shared";
import { getDb } from "../db.js";
import { getProvider } from "./registry.js";
import { registerJobHandler } from "../scheduler.js";

const JOB_TYPE = "agent.tick";

interface AgentTickPayload {
  agentId: string;
}

/**
 * Compute the absolute timestamp of the next tick. Returns `null` for
 * schedules that should not fire (`kind: "none"`).
 *
 * • `every-minutes`: `now + minutes`.
 * • `daily`: the next `HH:MM` in local time; rolls over to tomorrow if the
 *   target time has already passed today.
 */
export function computeNextTickAt(
  schedule: AgentSchedule,
  now: Date = new Date()
): Date | null {
  switch (schedule.kind) {
    case "none":
      return null;
    case "every-minutes": {
      const minutes = Math.max(1, Math.round(schedule.minutes));
      return new Date(now.getTime() + minutes * 60_000);
    }
    case "daily": {
      const next = new Date(now);
      next.setHours(schedule.hour, schedule.minute, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
  }
}

async function runAgentTurn(agent: AgentRecord): Promise<string> {
  const provider = getProvider(agent.provider);
  const messages = [];
  if (agent.systemPrompt.trim()) {
    messages.push({ role: "system" as const, content: agent.systemPrompt });
  }
  // The standing goal acts as the user prompt for a scheduled tick.
  const userPrompt = agent.goal.trim() || "Take your next scheduled action.";
  messages.push({ role: "user" as const, content: userPrompt });

  const response = await provider.complete({
    messages,
    model: agent.model ?? undefined
  });
  return response.text;
}

/** Re-enqueue the next tick for an agent based on its current schedule. */
async function enqueueNextTick(agent: AgentRecord): Promise<void> {
  const next = computeNextTickAt(agent.schedule);
  if (!next) return;
  const db = getDb();
  await enqueueJob(db, randomUUID(), JOB_TYPE, { agentId: agent.id }, next);
}

/**
 * Register the `agent.tick` handler. Idempotent: safe to call once at boot.
 */
export function registerAgentTickHandler(): void {
  registerJobHandler(JOB_TYPE, async (payload) => {
    const { agentId } = payload as unknown as AgentTickPayload;
    if (!agentId || typeof agentId !== "string") {
      throw new Error("agent.tick payload missing agentId");
    }
    const db = getDb();
    const agent = await getAgent(db, agentId);
    if (!agent) {
      // Agent was deleted; drop the tick chain.
      await appendAuditLog(db, "agent", "agent.tick.missing", agentId, {});
      return;
    }
    if (agent.schedule.kind === "none") {
      // Schedule disabled since this tick was enqueued; stop the chain.
      await appendAuditLog(db, "agent", "agent.tick.skipped", agentId, {
        reason: "schedule disabled"
      });
      return;
    }
    try {
      const output = await runAgentTurn(agent);
      await appendAuditLog(db, "agent", "agent.tick.ran", agentId, {
        provider: agent.provider,
        model: agent.model ?? null,
        outputPreview: output.slice(0, 500)
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await appendAuditLog(db, "agent", "agent.tick.error", agentId, {
        error: message
      });
      // Still re-enqueue so a transient provider blip doesn't kill the chain.
    } finally {
      // Re-fetch in case the schedule was changed during the run.
      const fresh = await getAgent(db, agentId);
      if (fresh) await enqueueNextTick(fresh);
    }
  });
}

/**
 * Seed pending `agent.tick` jobs at startup for every agent with a live
 * schedule that doesn't already have a pending tick.
 */
export async function scheduleAgentTicks(): Promise<void> {
  const db = getDb();
  const [agents, jobs] = await Promise.all([listAgents(db), listJobs(db)]);
  const pendingAgentIds = new Set(
    jobs
      .filter((j) => j.type === JOB_TYPE && j.status === "pending")
      .map((j) => (j.payload as unknown as AgentTickPayload).agentId)
  );
  for (const agent of agents) {
    if (agent.schedule.kind === "none") continue;
    if (pendingAgentIds.has(agent.id)) continue;
    await enqueueNextTick(agent);
  }
}

/**
 * Reseed an agent's tick chain after its schedule changes. Called from the
 * `agents:update` IPC handler. Safe to call when nothing needs to change.
 */
export async function rescheduleAgent(agentId: string): Promise<void> {
  const db = getDb();
  const agent = await getAgent(db, agentId);
  if (!agent) return;
  // Note: we don't proactively delete the previous pending tick. When it
  // fires, the handler re-fetches the agent and re-enqueues based on the
  // new schedule. If the schedule was switched to "none", the handler will
  // exit early. If the schedule was extended (e.g. every 5m → daily), the
  // old tick fires once at the old time, then the new cadence takes over.
  if (agent.schedule.kind !== "none") {
    // If no pending tick exists for this agent, seed one now so it doesn't
    // wait until the next restart to start firing.
    const jobs = await listJobs(db);
    const hasPending = jobs.some(
      (j) =>
        j.type === JOB_TYPE &&
        j.status === "pending" &&
        (j.payload as unknown as AgentTickPayload).agentId === agentId
    );
    if (!hasPending) await enqueueNextTick(agent);
  }
}
