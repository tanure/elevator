import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDb, type ElevatorDb } from "../db.js";
import { integrations } from "../schema.js";
import {
  deleteIntegration,
  getIntegration,
  listIntegrations,
  setIntegrationStatus,
  upsertIntegration
} from "../repositories/integrations.js";

let db: ElevatorDb;

beforeAll(async () => {
  db = await createDb(":memory:");
});

afterEach(async () => {
  await db.delete(integrations);
});

describe("integrations repository", () => {
  it("inserts a new integration on first upsert", async () => {
    const created = await upsertIntegration(db, {
      id: "gh-1",
      name: "github",
      type: "api",
      config: { token: "secret" }
    });
    expect(created.id).toBe("gh-1");
    expect(created.status).toBe("disconnected");
    expect(created.displayName).toBe("github");
    expect(created.config).toMatchObject({ token: "secret" });
  });

  it("updates an existing integration on subsequent upsert", async () => {
    await upsertIntegration(db, { id: "gh-2", name: "github", type: "api" });
    const updated = await upsertIntegration(db, {
      id: "gh-2",
      name: "github",
      type: "api",
      displayName: "GitHub Personal",
      config: { token: "new" }
    });
    expect(updated.displayName).toBe("GitHub Personal");
    expect(updated.config).toMatchObject({ token: "new" });
    expect(await listIntegrations(db)).toHaveLength(1);
  });

  it("changes status and stamps lastCheckedAt", async () => {
    await upsertIntegration(db, { id: "gh-3", name: "github", type: "api" });
    const result = await setIntegrationStatus(db, "gh-3", "connected");
    expect(result?.status).toBe("connected");
    expect(result?.lastCheckedAt).toBeInstanceOf(Date);
  });

  it("returns null for a missing integration", async () => {
    expect(await getIntegration(db, "missing")).toBeNull();
  });

  it("deletes by id", async () => {
    await upsertIntegration(db, { id: "del-1", name: "x", type: "api" });
    await deleteIntegration(db, "del-1");
    expect(await getIntegration(db, "del-1")).toBeNull();
  });
});
