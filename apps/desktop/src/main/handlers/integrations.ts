import { ipcMain } from "electron";
import { appendAuditLog, listIntegrations } from "@elevator/data";
import type {
  ConnectorTemplate,
  CreateIntegrationInstanceInput,
  Integration,
  IntegrationHealth,
  IntegrationMutationResult,
  IntegrationSyncData,
  ToolDescriptor,
  UpdateIntegrationInstanceInput
} from "@elevator/shared";
import { getDb } from "../db.js";
import {
  callConnectorTool,
  connectIntegration,
  createInstance,
  deleteInstance,
  disconnectIntegration,
  getSyncData,
  listAllTools,
  listTemplates,
  runHealthCheck,
  syncInstance,
  testInstance,
  updateInstance
} from "../integrations/registry.js";

export function registerIntegrationHandlers(): void {
  ipcMain.handle("integrations:list", async (): Promise<Integration[]> => {
    return listIntegrations(getDb());
  });

  ipcMain.handle("integrations:listTemplates", (): ConnectorTemplate[] => {
    return listTemplates();
  });

  ipcMain.handle(
    "integrations:create",
    async (_e, input: CreateIntegrationInstanceInput): Promise<IntegrationMutationResult> => {
      const result = await createInstance(input);
      await appendAuditLog(
        getDb(),
        "user",
        "integration.create",
        result.integration?.id ?? input.templateId,
        { ok: result.ok }
      );
      return result;
    }
  );

  ipcMain.handle(
    "integrations:update",
    async (
      _e,
      id: string,
      input: UpdateIntegrationInstanceInput
    ): Promise<IntegrationMutationResult> => {
      const result = await updateInstance(id, input);
      await appendAuditLog(getDb(), "user", "integration.update", id, { ok: result.ok });
      return result;
    }
  );

  ipcMain.handle("integrations:delete", async (_e, id: string): Promise<void> => {
    await deleteInstance(id);
    await appendAuditLog(getDb(), "user", "integration.delete", id);
  });

  ipcMain.handle(
    "integrations:test",
    async (
      _e,
      templateId: string,
      config: Record<string, unknown>,
      existingInstanceId?: string
    ): Promise<IntegrationHealth> => {
      const result = await testInstance(templateId, config, existingInstanceId);
      return { ok: result.ok, message: result.message, checkedAt: new Date() };
    }
  );

  ipcMain.handle("integrations:connect", async (_e, id: string): Promise<IntegrationHealth> => {
    const result = await connectIntegration(id);
    await appendAuditLog(getDb(), "user", "integration.connect", id, result);
    return { ok: result.ok, message: result.message, checkedAt: new Date() };
  });

  ipcMain.handle("integrations:disconnect", async (_e, id: string): Promise<void> => {
    await disconnectIntegration(id);
    await appendAuditLog(getDb(), "user", "integration.disconnect", id);
  });

  ipcMain.handle("integrations:check", async (_e, id: string): Promise<IntegrationHealth> => {
    const result = await runHealthCheck(id);
    return { ok: result.ok, message: result.message, checkedAt: new Date() };
  });

  ipcMain.handle("integrations:sync", async (_e, id: string): Promise<IntegrationHealth> => {
    const result = await syncInstance(id);
    await appendAuditLog(getDb(), "user", "integration.sync", id, { ok: result.ok });
    return { ok: result.ok, message: result.message, checkedAt: new Date() };
  });

  ipcMain.handle(
    "integrations:getSyncData",
    async (_e, id: string): Promise<IntegrationSyncData | null> => {
      return getSyncData(id);
    }
  );

  ipcMain.handle("integrations:listTools", async (): Promise<ToolDescriptor[]> => {
    return listAllTools();
  });

  ipcMain.handle(
    "integrations:callTool",
    async (
      _e,
      integrationId: string,
      toolId: string,
      input: Record<string, unknown>
    ) => {
      const result = await callConnectorTool(integrationId, toolId, input ?? {});
      await appendAuditLog(getDb(), "user", "tool.call", `${integrationId}:${toolId}`, {
        ok: result.ok
      });
      return result;
    }
  );
}
