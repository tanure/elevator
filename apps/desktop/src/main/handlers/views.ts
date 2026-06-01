import { ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import {
  createDashboardLayout,
  createView,
  createViewTemplate,
  deleteView,
  deleteViewTemplate,
  getView,
  getViewTemplate,
  listViewTemplates,
  listViews,
  updateView,
  updateViewTemplate
} from "@elevator/data";
import type {
  CreateViewInput,
  CreateViewTemplateInput,
  DashboardSlot,
  UpdateViewInput,
  UpdateViewTemplateInput,
  ViewRecord,
  ViewTemplate,
  ViewTemplateBody
} from "@elevator/shared";
import { getDb } from "../db.js";
import { eventBus } from "../event-bus.js";

function substituteSlots(
  slots: DashboardSlot[],
  _parameters: Record<string, unknown>
): DashboardSlot[] {
  // Parameters are surfaced to cards at render time via ViewContext.
  // For now slots are copied verbatim; placeholders inside extension titles
  // etc. can be wired in later phases.
  return slots.map((slot) => ({ cardId: slot.cardId, colSpan: slot.colSpan }));
}

export function registerViewHandlers(): void {
  ipcMain.handle("views:list", async (): Promise<ViewRecord[]> => listViews(getDb()));

  ipcMain.handle(
    "views:get",
    async (_e, id: string): Promise<ViewRecord | null> => getView(getDb(), id)
  );

  ipcMain.handle(
    "views:create",
    async (_e, input: CreateViewInput): Promise<ViewRecord> => {
      const view = await createView(getDb(), randomUUID(), input);
      eventBus.emit("view.created", { id: view.id });
      return view;
    }
  );

  ipcMain.handle(
    "views:update",
    async (
      _e,
      id: string,
      input: UpdateViewInput
    ): Promise<ViewRecord | null> => {
      const view = await updateView(getDb(), id, input);
      if (view) eventBus.emit("view.updated", { id });
      return view;
    }
  );

  ipcMain.handle("views:delete", async (_e, id: string): Promise<void> => {
    await deleteView(getDb(), id);
    eventBus.emit("view.deleted", { id });
  });

  ipcMain.handle(
    "views:createFromTemplate",
    async (
      _e,
      templateId: string,
      input: { name: string; parameters: Record<string, unknown>; groupName?: string }
    ): Promise<ViewRecord> => {
      const db = getDb();
      const tpl = await getViewTemplate(db, templateId);
      if (!tpl) throw new Error(`View template not found: ${templateId}`);
      const viewId = randomUUID();
      const layout = await createDashboardLayout(db, randomUUID(), {
        name: `${input.name} layout`,
        viewId,
        slots: substituteSlots(tpl.body.slots, input.parameters),
        isActive: true
      });
      const view = await createView(db, viewId, {
        groupName: input.groupName ?? tpl.body.groupName,
        name: input.name,
        icon: tpl.body.icon ?? "Folder",
        layoutId: layout.id,
        agentIds: tpl.body.agentIds ?? [],
        parameters: input.parameters,
        templateId: tpl.id
      });
      eventBus.emit("view.created", { id: view.id });
      return view;
    }
  );

  // ── View templates ──
  ipcMain.handle(
    "viewTemplates:list",
    async (): Promise<ViewTemplate[]> => listViewTemplates(getDb())
  );

  ipcMain.handle(
    "viewTemplates:get",
    async (_e, id: string): Promise<ViewTemplate | null> =>
      getViewTemplate(getDb(), id)
  );

  ipcMain.handle(
    "viewTemplates:create",
    async (_e, input: CreateViewTemplateInput): Promise<ViewTemplate> => {
      const tpl = await createViewTemplate(getDb(), randomUUID(), input);
      eventBus.emit("view.template.created", { id: tpl.id });
      return tpl;
    }
  );

  ipcMain.handle(
    "viewTemplates:update",
    async (
      _e,
      id: string,
      input: UpdateViewTemplateInput
    ): Promise<ViewTemplate | null> => {
      const tpl = await updateViewTemplate(getDb(), id, input);
      if (tpl) eventBus.emit("view.template.updated", { id });
      return tpl;
    }
  );

  ipcMain.handle(
    "viewTemplates:delete",
    async (_e, id: string): Promise<void> => {
      await deleteViewTemplate(getDb(), id);
      eventBus.emit("view.template.deleted", { id });
    }
  );

  /**
   * Capture an existing view's layout into a new template. Slots are copied
   * verbatim. Parameter schema is derived from the view's parameter keys.
   */
  ipcMain.handle(
    "viewTemplates:createFromView",
    async (
      _e,
      viewId: string,
      input: { name: string; description?: string }
    ): Promise<ViewTemplate> => {
      const db = getDb();
      const view = await getView(db, viewId);
      if (!view) throw new Error(`View not found: ${viewId}`);
      let slots: DashboardSlot[] = [];
      if (view.layoutId) {
        const { getDashboardLayout } = await import("@elevator/data");
        const layout = await getDashboardLayout(db, view.layoutId);
        if (layout) slots = layout.slots;
      }
      const body: ViewTemplateBody = {
        groupName: view.groupName,
        icon: view.icon,
        slots,
        agentIds: view.agentIds,
        parameters: Object.keys(view.parameters).map((name) => ({
          name,
          label: name
        }))
      };
      const tpl = await createViewTemplate(db, randomUUID(), {
        name: input.name,
        description: input.description ?? "",
        body
      });
      eventBus.emit("view.template.created", { id: tpl.id });
      return tpl;
    }
  );
}
