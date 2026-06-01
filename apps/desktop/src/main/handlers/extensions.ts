import { ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import {
  createExtension,
  deleteExtension,
  getExtension,
  getLatestSuccessfulRunForAgent,
  listExtensions,
  updateExtension
} from "@elevator/data";
import type {
  AgentRun,
  CreateExtensionInput,
  ExtensionRecord,
  UpdateExtensionInput
} from "@elevator/shared";
import { getDb } from "../db.js";
import { eventBus } from "../event-bus.js";

export function registerExtensionHandlers(): void {
  ipcMain.handle(
    "extensions:list",
    async (): Promise<ExtensionRecord[]> => listExtensions(getDb())
  );

  ipcMain.handle(
    "extensions:get",
    async (_e, id: string): Promise<ExtensionRecord | null> =>
      getExtension(getDb(), id)
  );

  ipcMain.handle(
    "extensions:create",
    async (_e, input: CreateExtensionInput): Promise<ExtensionRecord> => {
      const ext = await createExtension(getDb(), randomUUID(), input);
      eventBus.emit("extension.created", { id: ext.id });
      return ext;
    }
  );

  ipcMain.handle(
    "extensions:update",
    async (
      _e,
      id: string,
      input: UpdateExtensionInput
    ): Promise<ExtensionRecord | null> => {
      const ext = await updateExtension(getDb(), id, input);
      if (ext) eventBus.emit("extension.updated", { id });
      return ext;
    }
  );

  ipcMain.handle(
    "extensions:delete",
    async (_e, id: string): Promise<void> => {
      await deleteExtension(getDb(), id);
      eventBus.emit("extension.deleted", { id });
    }
  );

  ipcMain.handle(
    "extensions:latestRun",
    async (_e, agentId: string): Promise<AgentRun | null> =>
      getLatestSuccessfulRunForAgent(getDb(), agentId)
  );
}
