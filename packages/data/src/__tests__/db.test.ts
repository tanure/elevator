import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../db.js";
import type { ElevatorDb } from "../db.js";
import { notes, settings, tasks } from "../schema.js";
import { createTask, listTasks, setTaskStatus } from "../repositories/tasks.js";
import { createNote, listNotes } from "../repositories/notes.js";
import { getAllSettings, getSetting, setSetting } from "../repositories/settings.js";

let db: ElevatorDb;

beforeAll(async () => {
  db = await createDb(":memory:");
});

afterEach(async () => {
  await db.delete(tasks);
  await db.delete(notes);
  await db.delete(settings);
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
    await createNote(db, crypto.randomUUID(), { title: "My note", content: "Hello" });
    const rows = await listNotes(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("My note");
    expect(rows[0].tags).toEqual([]);
  });
});
