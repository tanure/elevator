import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDb, type ElevatorDb } from "../db.js";
import { agentRuns, auditLog, integrations, jobQueue, notes, settings, tasks } from "../schema.js";
import { exportAll } from "../export.js";
import { upsertIntegration } from "../repositories/integrations.js";
import { createNote } from "../repositories/notes.js";
import { createTask } from "../repositories/tasks.js";
import { setSetting } from "../repositories/settings.js";

let db: ElevatorDb;

beforeAll(async () => {
  db = await createDb(":memory:");
});

afterEach(async () => {
  await db.delete(agentRuns);
  await db.delete(auditLog);
  await db.delete(jobQueue);
  await db.delete(integrations);
  await db.delete(tasks);
  await db.delete(notes);
  await db.delete(settings);
});

describe("exportAll", () => {
  it("includes all collections with stable shape on an empty db", async () => {
    const snapshot = await exportAll(db, { schemaVersion: 9 });
    expect(snapshot.schemaVersion).toBe(9);
    expect(typeof snapshot.exportedAt).toBe("string");
    expect(snapshot.notes).toEqual([]);
    expect(snapshot.tasks).toEqual([]);
    expect(snapshot.integrations).toEqual([]);
    expect(snapshot.jobs).toEqual([]);
    expect(snapshot.settings).toEqual({});
    expect(snapshot.auditLog).toEqual([]);
    expect(snapshot.agentRuns).toEqual([]);
  });

  it("captures inserted notes, tasks and settings", async () => {
    await createNote(db, "n1", { title: "Hello", contentJson: [] });
    await createTask(db, "t1", { title: "Do it" });
    await setSetting(db, "theme", "dark");
    const snapshot = await exportAll(db);
    expect(snapshot.notes).toHaveLength(1);
    expect(snapshot.notes[0]).toMatchObject({ title: "Hello" });
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.tasks[0]).toMatchObject({ title: "Do it" });
    expect(snapshot.settings).toMatchObject({ theme: "dark" });
  });

  it("redacts secrets in integration config when redactSecrets=true", async () => {
    await upsertIntegration(db, {
      id: "i-1",
      name: "GitHub",
      type: "api",
      config: {
        token: "ghp_supersecret",
        clientSecret: "shhh",
        baseUrl: "https://api.github.com",
        nested: { apiKey: "k-1", label: "ok" }
      }
    });

    const redacted = await exportAll(db, { redactSecrets: true });
    const cfg = (redacted.integrations[0] as { config: Record<string, unknown> }).config;
    expect(cfg.token).toBe("[REDACTED]");
    expect(cfg.clientSecret).toBe("[REDACTED]");
    expect(cfg.baseUrl).toBe("https://api.github.com");
    const nested = cfg.nested as Record<string, unknown>;
    expect(nested.apiKey).toBe("[REDACTED]");
    expect(nested.label).toBe("ok");
  });

  it("preserves secrets when redactSecrets=false", async () => {
    await upsertIntegration(db, {
      id: "i-2",
      name: "GitHub",
      type: "api",
      config: { token: "ghp_keep" }
    });
    const raw = await exportAll(db, { redactSecrets: false });
    const cfg = (raw.integrations[0] as { config: Record<string, unknown> }).config;
    expect(cfg.token).toBe("ghp_keep");
  });
});
