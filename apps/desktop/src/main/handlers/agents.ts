import { ipcMain } from "electron";
import { listAgentRuns } from "@elevator/data";
import type { AgentRun, AiProviderName, SkillManifest } from "@elevator/shared";
import { getDb } from "../db.js";
import {
  getActiveProvider,
  listProviders,
  setActiveProvider
} from "../ai/registry.js";
import { runSkill } from "../ai/runner.js";
import { listSkillManifests } from "../ai/skills.js";

export function registerAgentHandlers(): void {
  ipcMain.handle("agents:listSkills", async (): Promise<SkillManifest[]> => {
    return listSkillManifests();
  });

  ipcMain.handle("agents:listProviders", async () => {
    return { providers: listProviders(), active: getActiveProvider() };
  });

  ipcMain.handle("agents:setProvider", async (_e, name: AiProviderName) => {
    setActiveProvider(name);
    return { active: getActiveProvider() };
  });

  ipcMain.handle(
    "agents:run",
    async (_e, skillId: string, input: Record<string, unknown>): Promise<AgentRun> => {
      return runSkill(skillId, input ?? {});
    }
  );

  ipcMain.handle("agents:history", async (_e, limit?: number): Promise<AgentRun[]> => {
    return listAgentRuns(getDb(), { limit });
  });
}
