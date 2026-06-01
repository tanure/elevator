import type { CreateSkillInput } from "@elevator/shared";
import { listNotes, listTasks, upsertBuiltInSkill } from "@elevator/data";
import { getDb } from "../db.js";
export { renderPromptTemplate } from "./template.js";

/**
 * Optional "context provider" for a built-in skill. Returns extra variables
 * to merge into the user-supplied input before the prompt template is
 * rendered. Lets us keep the data-driven skill UI while still allowing
 * a few system skills to pull live data from the local DB.
 */
export type SkillContextProvider = (
  input: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const contextProviders = new Map<string, SkillContextProvider>();

export function registerSkillContextProvider(
  id: string,
  provider: SkillContextProvider
): void {
  contextProviders.set(id, provider);
}

export function getSkillContextProvider(id: string): SkillContextProvider | undefined {
  return contextProviders.get(id);
}

// ── Built-in skill seeds ─────────────────────────────────────────────────────

const DAILY_BRIEF: CreateSkillInput & { id: string } = {
  id: "daily-brief",
  name: "Daily brief",
  description:
    "Summarise today's open tasks and pinned notes into a short morning briefing.",
  systemPrompt:
    "You are Elevator, a focused productivity assistant. Produce a concise morning briefing in under 120 words. Group by theme. Highlight the single most important next action.",
  promptTemplate:
    "Date: {{date}}\n\nOpen tasks:\n{{tasks}}\n\nPinned notes:\n{{notes}}\n\nWrite the briefing now.",
  inputVariables: ["date", "tasks", "notes"],
  allowedTools: [],
  isBuiltIn: true
};

const dailyBriefContextProvider: SkillContextProvider = async () => {
  const db = getDb();
  const [tasks, notes] = await Promise.all([listTasks(db), listNotes(db)]);
  const openTasks = tasks.filter((t) => t.status !== "done").slice(0, 10);
  const pinnedNotes = notes.filter((n) => n.isPinned).slice(0, 5);
  const taskLines = openTasks.length
    ? openTasks
        .map(
          (t) =>
            `- [${t.priority}] ${t.title}${
              t.dueAt ? ` (due ${t.dueAt.toISOString().slice(0, 10)})` : ""
            }`
        )
        .join("\n")
    : "(none)";
  const noteLines = pinnedNotes.length
    ? pinnedNotes.map((n) => `- ${n.title}`).join("\n")
    : "(none)";
  return {
    date: new Date().toISOString().slice(0, 10),
    tasks: taskLines,
    notes: noteLines
  };
};

/**
 * Seed the DB with built-in skills at startup. Idempotent — re-running just
 * refreshes the prompt/template fields so updates ship via new app versions.
 */
export async function ensureBuiltInSkillsRegistered(): Promise<void> {
  const db = getDb();
  await upsertBuiltInSkill(db, DAILY_BRIEF);
  registerSkillContextProvider(DAILY_BRIEF.id, dailyBriefContextProvider);
}


