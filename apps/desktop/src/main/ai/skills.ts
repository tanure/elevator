import type { SkillManifest } from "@elevator/shared";
import { listNotes, listTasks } from "@elevator/data";
import { getDb } from "../db.js";

export interface SkillContext {
  /** Resolved variables that the skill rendered into its prompt */
  variables: Record<string, unknown>;
  /** Final user message handed to the AI provider */
  prompt: string;
  systemPrompt: string;
}

export type SkillBuilder = (input: Record<string, unknown>) => Promise<SkillContext>;

interface RegisteredSkill {
  manifest: SkillManifest;
  build: SkillBuilder;
}

const skills = new Map<string, RegisteredSkill>();

export function registerSkill(manifest: SkillManifest, build: SkillBuilder): void {
  skills.set(manifest.id, { manifest, build });
}

export function getSkill(id: string): RegisteredSkill | undefined {
  return skills.get(id);
}

export function listSkillManifests(): SkillManifest[] {
  return [...skills.values()].map((s) => s.manifest);
}

// ── Built-in skills ──────────────────────────────────────────────────────────

const DAILY_BRIEF_MANIFEST: SkillManifest = {
  id: "daily-brief",
  title: "Daily brief",
  description:
    "Summarise today's open tasks and pinned notes into a short morning briefing.",
  requiredPermissions: ["dashboard:read"],
  allowedTools: []
};

async function buildDailyBrief(_input: Record<string, unknown>): Promise<SkillContext> {
  const db = getDb();
  const [tasks, notes] = await Promise.all([listTasks(db), listNotes(db)]);
  const openTasks = tasks.filter((t) => t.status !== "done").slice(0, 10);
  const pinnedNotes = notes.filter((n) => n.isPinned).slice(0, 5);

  const taskLines = openTasks.length
    ? openTasks
        .map((t) => `- [${t.priority}] ${t.title}${t.dueAt ? ` (due ${t.dueAt.toISOString().slice(0, 10)})` : ""}`)
        .join("\n")
    : "(none)";
  const noteLines = pinnedNotes.length
    ? pinnedNotes.map((n) => `- ${n.title}`).join("\n")
    : "(none)";

  const systemPrompt =
    "You are Elevator, a focused productivity assistant. Produce a concise morning briefing in under 120 words. Group by theme. Highlight the single most important next action.";
  const prompt =
    `Date: ${new Date().toISOString().slice(0, 10)}\n\n` +
    `Open tasks:\n${taskLines}\n\n` +
    `Pinned notes:\n${noteLines}\n\n` +
    `Write the briefing now.`;

  return {
    variables: { taskCount: openTasks.length, noteCount: pinnedNotes.length },
    prompt,
    systemPrompt
  };
}

export function ensureBuiltInSkillsRegistered(): void {
  if (skills.size === 0) {
    registerSkill(DAILY_BRIEF_MANIFEST, buildDailyBrief);
  }
}
