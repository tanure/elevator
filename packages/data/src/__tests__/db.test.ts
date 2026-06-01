import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../db.js";
import type { ElevatorDb } from "../db.js";
import { agents, notes, settings, skills, tasks } from "../schema.js";
import { createTask, listTasks, setTaskStatus } from "../repositories/tasks.js";
import { createNote, listNotes } from "../repositories/notes.js";
import { getAllSettings, getSetting, setSetting } from "../repositories/settings.js";
import {
  createSkill,
  deleteSkill,
  getSkill,
  listSkills,
  updateSkill,
  upsertBuiltInSkill
} from "../repositories/skills.js";
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  updateAgent
} from "../repositories/agents.js";

let db: ElevatorDb;

beforeAll(async () => {
  db = await createDb(":memory:");
});

afterEach(async () => {
  await db.delete(tasks);
  await db.delete(notes);
  await db.delete(settings);
  await db.delete(skills);
  await db.delete(agents);
});

describe("settings", () => {
  it("set and get round-trip", async () => {
    await setSetting(db, "theme", "dark");
    expect(await getSetting(db, "theme")).toBe("dark");
  });

  it("getAll returns all keys", async () => {
    await setSetting(db, "a", "1");
    await setSetting(db, "b", "2");
    const all = await getAllSettings(db);
    expect(all).toMatchObject({ a: "1", b: "2" });
  });

  it("overwrite existing key", async () => {
    await setSetting(db, "theme", "light");
    await setSetting(db, "theme", "dark");
    expect(await getSetting(db, "theme")).toBe("dark");
  });
});

describe("tasks", () => {
  it("create and list", async () => {
    await createTask(db, crypto.randomUUID(), { title: "Test task" });
    const rows = await listTasks(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Test task");
    expect(rows[0].status).toBe("todo");
  });

  it("setStatus marks done with completedAt", async () => {
    const id = crypto.randomUUID();
    await createTask(db, id, { title: "Finish me" });
    const updated = await setTaskStatus(db, id, "done");
    expect(updated?.status).toBe("done");
    expect(updated?.completedAt).toBeInstanceOf(Date);
  });
});

describe("notes", () => {
  it("create and list", async () => {
    await createNote(db, crypto.randomUUID(), { title: "My note", contentJson: [] });
    const rows = await listNotes(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("My note");
    expect(rows[0].tags).toEqual([]);
  });
});

describe("skills repository", () => {
  it("create, get, list, update, delete round-trip", async () => {
    const created = await createSkill(db, {
      name: "Summarise",
      description: "test",
      systemPrompt: "sys",
      promptTemplate: "Say hi to {{name}}",
      inputVariables: ["name"],
      allowedTools: ["foo.bar"]
    });
    expect(created.id).toBeTruthy();
    expect(created.inputVariables).toEqual(["name"]);
    expect(created.allowedTools).toEqual(["foo.bar"]);
    expect(created.isBuiltIn).toBe(false);

    const fetched = await getSkill(db, created.id);
    expect(fetched?.name).toBe("Summarise");

    const all = await listSkills(db);
    expect(all).toHaveLength(1);

    const updated = await updateSkill(db, created.id, {
      name: "Renamed",
      allowedTools: []
    });
    expect(updated?.name).toBe("Renamed");
    expect(updated?.allowedTools).toEqual([]);

    expect(await deleteSkill(db, created.id)).toBe(true);
    expect(await getSkill(db, created.id)).toBeNull();
  });

  it("blocks deletion of built-in skills and updates on upsert", async () => {
    const seeded = await upsertBuiltInSkill(db, {
      id: "daily-brief",
      name: "Daily brief",
      description: "v1",
      systemPrompt: "",
      promptTemplate: "",
      inputVariables: [],
      allowedTools: []
    });
    expect(seeded.isBuiltIn).toBe(true);

    await expect(deleteSkill(db, "daily-brief")).rejects.toThrow();

    const re = await upsertBuiltInSkill(db, {
      id: "daily-brief",
      name: "Daily brief",
      description: "v2",
      systemPrompt: "",
      promptTemplate: "",
      inputVariables: [],
      allowedTools: []
    });
    expect(re.description).toBe("v2");
    expect(re.isBuiltIn).toBe(true);
  });
});

describe("agents repository", () => {
  it("create, update, delete", async () => {
    const created = await createAgent(db, {
      name: "Helper",
      description: "",
      provider: "echo",
      model: null,
      skillIds: ["skill-a", "skill-b"],
      maxToolCalls: 3
    });
    expect(created.provider).toBe("echo");
    expect(created.skillIds).toEqual(["skill-a", "skill-b"]);
    expect(created.maxToolCalls).toBe(3);

    const updated = await updateAgent(db, created.id, {
      maxToolCalls: 7,
      skillIds: ["skill-a"]
    });
    expect(updated?.maxToolCalls).toBe(7);
    expect(updated?.skillIds).toEqual(["skill-a"]);

    const all = await listAgents(db);
    expect(all).toHaveLength(1);

    expect(await deleteAgent(db, created.id)).toBe(true);
    expect(await getAgent(db, created.id)).toBeNull();
  });

  it("blocks deletion of built-in agents", async () => {
    const created = await createAgent(db, {
      name: "Built-in",
      description: "",
      provider: "echo",
      model: null,
      skillIds: [],
      maxToolCalls: 5,
      isBuiltIn: true
    });
    await expect(deleteAgent(db, created.id)).rejects.toThrow();
  });
});
