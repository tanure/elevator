import { ipcMain } from "electron";
import {
  createAgent,
  createSkill,
  deleteAgent,
  deleteSkill,
  getAgent,
  getSkill,
  listAgentRuns,
  listAgents,
  listSkills,
  updateAgent,
  updateSkill
} from "@elevator/data";
import type {
  AgentRecord,
  AgentRun,
  AgentTool,
  AiProviderName,
  CreateAgentInput,
  CreateSkillInput,
  SkillManifest,
  SkillRecord,
  UpdateAgentInput,
  UpdateSkillInput
} from "@elevator/shared";
import { getDb } from "../db.js";
import {
  getActiveProvider,
  listProviders,
  setActiveProvider
} from "../ai/registry.js";
import { runSkill } from "../ai/runner.js";
import { listAgentTools } from "../ai/tools.js";
import { rescheduleAgent } from "../ai/agent-ticks.js";

/** Legacy adapter: derive a SkillManifest from a SkillRecord for any
 *  code that still expects the old shape (palette, dashboards, etc.). */
function recordToManifest(s: SkillRecord): SkillManifest {
  return {
    id: s.id,
    title: s.name,
    description: s.description,
    requiredPermissions: [],
    allowedTools: s.allowedTools
  };
}

export function registerAgentHandlers(): void {
  // ── Providers (kept for now; Settings UI will consume these) ──────────────
  ipcMain.handle("agents:listProviders", async () => {
    return { providers: listProviders(), active: getActiveProvider() };
  });

  ipcMain.handle("agents:setProvider", async (_e, name: AiProviderName) => {
    setActiveProvider(name);
    return { active: getActiveProvider() };
  });

  // ── Skills CRUD ───────────────────────────────────────────────────────────
  ipcMain.handle("skills:list", async (): Promise<SkillRecord[]> => {
    return listSkills(getDb());
  });

  ipcMain.handle("skills:get", async (_e, id: string): Promise<SkillRecord | null> => {
    return getSkill(getDb(), id);
  });

  ipcMain.handle(
    "skills:create",
    async (_e, input: CreateSkillInput): Promise<SkillRecord> => {
      return createSkill(getDb(), input);
    }
  );

  ipcMain.handle(
    "skills:update",
    async (_e, id: string, input: UpdateSkillInput): Promise<SkillRecord | null> => {
      return updateSkill(getDb(), id, input);
    }
  );

  ipcMain.handle("skills:delete", async (_e, id: string): Promise<boolean> => {
    return deleteSkill(getDb(), id);
  });

  ipcMain.handle(
    "skills:run",
    async (
      _e,
      skillId: string,
      input: Record<string, unknown>
    ): Promise<AgentRun> => {
      return runSkill(skillId, input ?? {});
    }
  );

  // ── Agents CRUD ───────────────────────────────────────────────────────────
  ipcMain.handle("agents:list", async (): Promise<AgentRecord[]> => {
    return listAgents(getDb());
  });

  ipcMain.handle("agents:get", async (_e, id: string): Promise<AgentRecord | null> => {
    return getAgent(getDb(), id);
  });

  ipcMain.handle(
    "agents:create",
    async (_e, input: CreateAgentInput): Promise<AgentRecord> => {
      const agent = await createAgent(getDb(), input);
      if (agent.schedule.kind !== "none") {
        await rescheduleAgent(agent.id);
      }
      return agent;
    }
  );

  ipcMain.handle(
    "agents:update",
    async (
      _e,
      id: string,
      input: UpdateAgentInput
    ): Promise<AgentRecord | null> => {
      const updated = await updateAgent(getDb(), id, input);
      if (updated && input.schedule !== undefined) {
        await rescheduleAgent(id);
      }
      return updated;
    }
  );

  ipcMain.handle("agents:delete", async (_e, id: string): Promise<boolean> => {
    return deleteAgent(getDb(), id);
  });

  ipcMain.handle(
    "agents:runSkill",
    async (
      _e,
      agentId: string,
      skillId: string,
      input: Record<string, unknown>
    ): Promise<AgentRun> => {
      return runSkill(skillId, input ?? {}, { agentId });
    }
  );

  ipcMain.handle(
    "agents:listAvailableTools",
    async (): Promise<AgentTool[]> => {
      return listAgentTools();
    }
  );

  // ── Run history ───────────────────────────────────────────────────────────
  ipcMain.handle("agents:history", async (_e, limit?: number): Promise<AgentRun[]> => {
    return listAgentRuns(getDb(), { limit });
  });

  // ── Legacy compatibility shims ────────────────────────────────────────────
  ipcMain.handle("agents:listSkills", async (): Promise<SkillManifest[]> => {
    const records = await listSkills(getDb());
    return records.map(recordToManifest);
  });

  ipcMain.handle(
    "agents:run",
    async (_e, skillId: string, input: Record<string, unknown>): Promise<AgentRun> => {
      return runSkill(skillId, input ?? {});
    }
  );
}
