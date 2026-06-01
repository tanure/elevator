import { ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import {
  createDashboardLayout,
  deleteDashboardLayout,
  getActiveDashboardLayout,
  getDashboardLayout,
  listDashboardLayouts,
  updateDashboardLayout
} from "@elevator/data";
import type {
  CreateDashboardLayoutInput,
  DashboardLayout,
  UpdateDashboardLayoutInput
} from "@elevator/shared";
import { getDb } from "../db.js";
import { eventBus } from "../event-bus.js";

export function registerDashboardLayoutHandlers(): void {
  ipcMain.handle(
    "dashboardLayouts:list",
    async (): Promise<DashboardLayout[]> => listDashboardLayouts(getDb())
  );

  ipcMain.handle(
    "dashboardLayouts:get",
    async (_e, id: string): Promise<DashboardLayout | null> =>
      getDashboardLayout(getDb(), id)
  );

  ipcMain.handle(
    "dashboardLayouts:getActive",
    async (
      _e,
      viewId: string | null = null
    ): Promise<DashboardLayout | null> =>
      getActiveDashboardLayout(getDb(), viewId)
  );

  ipcMain.handle(
    "dashboardLayouts:create",
    async (
      _e,
      input: CreateDashboardLayoutInput
    ): Promise<DashboardLayout> => {
      const layout = await createDashboardLayout(getDb(), randomUUID(), input);
      eventBus.emit("dashboard.layout.updated", { id: layout.id });
      return layout;
    }
  );

  ipcMain.handle(
    "dashboardLayouts:update",
    async (
      _e,
      id: string,
      input: UpdateDashboardLayoutInput
    ): Promise<DashboardLayout | null> => {
      const layout = await updateDashboardLayout(getDb(), id, input);
      if (layout) eventBus.emit("dashboard.layout.updated", { id });
      return layout;
    }
  );

  ipcMain.handle(
    "dashboardLayouts:delete",
    async (_e, id: string): Promise<void> => {
      await deleteDashboardLayout(getDb(), id);
      eventBus.emit("dashboard.layout.updated", { id });
    }
  );
}
