import { useEffect, useState, type ReactElement } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Badge } from "@renderer/components/ui/badge";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { useTasksStore } from "@renderer/stores/useTasksStore";
import type { TaskStatus } from "@elevator/shared";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: "in-progress",
  "in-progress": "done",
  done: "todo",
  cancelled: "todo",
};

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

function statusVariant(status: TaskStatus): BadgeVariant {
  if (status === "done") return "default";
  if (status === "in-progress") return "secondary";
  if (status === "cancelled") return "destructive";
  return "outline";
}

export function Tasks(): ReactElement {
  const { tasks, load, createTask, deleteTask, setTaskStatus } = useTasksStore();
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = (): void => {
    if (!newTitle.trim()) return;
    void createTask({ title: newTitle.trim() }).then(() => setNewTitle(""));
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Tasks</h1>

      <div className="mb-6 flex gap-2">
        <Input
          placeholder="Add a new task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <Button onClick={handleCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-180px)]">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet. Add one above!</p>
        ) : (
          <ul className="space-y-2 pr-4">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <button
                  type="button"
                  title="Cycle status"
                  onClick={() => void setTaskStatus(task.id, STATUS_CYCLE[task.status])}
                >
                  <Badge variant={statusVariant(task.status)} className="cursor-pointer text-xs">
                    {STATUS_LABELS[task.status]}
                  </Badge>
                </button>

                <span
                  className={`flex-1 text-sm ${
                    task.status === "done"
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {task.title}
                </span>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => void deleteTask(task.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
