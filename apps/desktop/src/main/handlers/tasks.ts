import { ipcMain } from "electron";
import { createTask, deleteTask, listTasks, setTaskStatus, updateTask } from "@elevator/data";
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from "@elevator/shared";
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
}
