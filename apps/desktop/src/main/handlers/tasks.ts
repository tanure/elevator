import { ipcMain } from "electron";
import {
  createTask,
  createTaskLabel,
  createTaskSuggestion,
  deleteTask,
  deleteTaskLabel,
  deleteTaskSuggestion,
  listTaskLabels,
  listTaskSuggestions,
  listTasks,
  setTaskStatus,
  setTaskSuggestionStatus,
  updateTask,
  updateTaskLabel
} from "@elevator/data";
import type {
  CreateTaskInput,
  CreateTaskLabelInput,
  CreateTaskSuggestionInput,
  Task,
  TaskLabel,
  TaskStatus,
  TaskSuggestion,
  TaskSuggestionStatus,
  UpdateTaskInput,
  UpdateTaskLabelInput
} from "@elevator/shared";
import { getDb } from "../db.js";
import { eventBus } from "../event-bus.js";

export function registerTaskHandlers(): void {
  ipcMain.handle("tasks:list", async (): Promise<Task[]> => {
    return listTasks(getDb());
  });

  ipcMain.handle("tasks:create", async (_event, input: CreateTaskInput): Promise<Task> => {
    const id = crypto.randomUUID();
    const task = await createTask(getDb(), id, input);
    eventBus.emit("task.created", { id });
    return task;
  });

  ipcMain.handle(
    "tasks:update",
    async (_event, id: string, updates: UpdateTaskInput): Promise<Task | null> => {
      const task = await updateTask(getDb(), id, updates);
      if (task) eventBus.emit("task.updated", { id });
      return task;
    }
  );

  ipcMain.handle("tasks:delete", async (_event, id: string): Promise<void> => {
    await deleteTask(getDb(), id);
    eventBus.emit("task.deleted", { id });
  });

  ipcMain.handle(
    "tasks:setStatus",
    async (_event, id: string, status: TaskStatus): Promise<Task | null> => {
      const task = await setTaskStatus(getDb(), id, status);
      if (task) eventBus.emit("task.updated", { id });
      return task;
    }
  );

  // ---- Task labels ----
  ipcMain.handle("taskLabels:list", async (): Promise<TaskLabel[]> => {
    return listTaskLabels(getDb());
  });

  ipcMain.handle(
    "taskLabels:create",
    async (_event, input: CreateTaskLabelInput): Promise<TaskLabel> => {
      const id = crypto.randomUUID();
      const label = await createTaskLabel(getDb(), id, input);
      eventBus.emit("task.label.created", { id });
      return label;
    }
  );

  ipcMain.handle(
    "taskLabels:update",
    async (
      _event,
      id: string,
      updates: UpdateTaskLabelInput
    ): Promise<TaskLabel | null> => {
      const label = await updateTaskLabel(getDb(), id, updates);
      if (label) eventBus.emit("task.label.updated", { id });
      return label;
    }
  );

  ipcMain.handle(
    "taskLabels:delete",
    async (_event, id: string): Promise<void> => {
      await deleteTaskLabel(getDb(), id);
      eventBus.emit("task.label.deleted", { id });
    }
  );

  // ---- Task suggestions ----
  ipcMain.handle(
    "taskSuggestions:list",
    async (_event, status?: TaskSuggestionStatus): Promise<TaskSuggestion[]> => {
      return listTaskSuggestions(getDb(), status);
    }
  );

  ipcMain.handle(
    "taskSuggestions:create",
    async (
      _event,
      input: CreateTaskSuggestionInput
    ): Promise<TaskSuggestion> => {
      const id = crypto.randomUUID();
      const suggestion = await createTaskSuggestion(getDb(), id, input);
      eventBus.emit("task.suggestion.created", { id });
      return suggestion;
    }
  );

  ipcMain.handle(
    "taskSuggestions:setStatus",
    async (
      _event,
      id: string,
      status: TaskSuggestionStatus
    ): Promise<TaskSuggestion | null> => {
      const suggestion = await setTaskSuggestionStatus(getDb(), id, status);
      if (suggestion) eventBus.emit("task.suggestion.resolved", { id, status });
      return suggestion;
    }
  );

  ipcMain.handle(
    "taskSuggestions:accept",
    async (_event, id: string): Promise<Task | null> => {
      const db = getDb();
      const list = await listTaskSuggestions(db);
      const suggestion = list.find((s) => s.id === id);
      if (!suggestion) return null;
      const taskId = crypto.randomUUID();
      const task = await createTask(db, taskId, {
        title: suggestion.title,
        description: suggestion.description ?? undefined,
        priority: suggestion.priority,
        dueAt: suggestion.dueAt ?? undefined
      });
      await setTaskSuggestionStatus(db, id, "accepted");
      eventBus.emit("task.created", { id: taskId });
      eventBus.emit("task.suggestion.resolved", { id, status: "accepted" });
      return task;
    }
  );

  ipcMain.handle(
    "taskSuggestions:delete",
    async (_event, id: string): Promise<void> => {
      await deleteTaskSuggestion(getDb(), id);
    }
  );
}
