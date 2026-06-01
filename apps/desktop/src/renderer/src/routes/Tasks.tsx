import { useEffect, useMemo, useState, type DragEvent, type ReactElement } from "react";
import { Plus, Trash2, Check, X, Tag, Pencil } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Textarea } from "@renderer/components/ui/textarea";
import { Badge } from "@renderer/components/ui/badge";
import { Label } from "@renderer/components/ui/label";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ui/dialog";
import { useTasksStore } from "@renderer/stores/useTasksStore";
import { useTaskLabelsStore } from "@renderer/stores/useTaskLabelsStore";
import { useTaskSuggestionsStore } from "@renderer/stores/useTaskSuggestionsStore";
import type {
  Task,
  TaskLabel,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput
} from "@elevator/shared";

type ViewMode = "list" | "board" | "calendar" | "day";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
  cancelled: "Cancelled"
};

const STATUSES: TaskStatus[] = ["todo", "in-progress", "done", "cancelled"];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-600"
};

function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function fromLocalInput(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// =================== Task Dialog ===================
interface TaskDialogProps {
  open: boolean;
  task: Task | null;
  labels: TaskLabel[];
  onClose: () => void;
  onSave: (id: string | null, updates: UpdateTaskInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function TaskDialog({ open, task, labels, onClose, onSave, onDelete }: TaskDialogProps): ReactElement {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [startAt, setStartAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? "todo");
      setPriority(task?.priority ?? "medium");
      setStartAt(toLocalInput(task?.startAt ?? null));
      setDueAt(toLocalInput(task?.dueAt ?? null));
      setLabelIds(task?.labelIds ?? []);
    }
  }, [open, task]);

  const handleSave = async (): Promise<void> => {
    if (!title.trim()) return;
    await onSave(task?.id ?? null, {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      status,
      priority,
      startAt: fromLocalInput(startAt),
      dueAt: fromLocalInput(dueAt),
      labelIds
    });
    onClose();
  };

  const toggleLabel = (id: string): void => {
    setLabelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <select
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div>
              <Label>Due</Label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>
          {labels.length > 0 && (
            <div>
              <Label>Labels</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {labels.map((l) => {
                  const on = labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        on ? "text-white" : "text-foreground/70 border"
                      }`}
                      style={on ? { backgroundColor: l.color } : { borderColor: l.color }}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex items-center justify-between">
          <div>
            {task && onDelete && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  await onDelete(task.id);
                  onClose();
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Label Manager ===================
interface LabelManagerProps {
  open: boolean;
  onClose: () => void;
}

function LabelManager({ open, onClose }: LabelManagerProps): ReactElement {
  const { labels, load, createLabel, updateLabel, deleteLabel } = useTaskLabelsStore();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#64748b");

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Labels</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {labels.map((l) => (
            <div key={l.id} className="flex items-center gap-2 rounded border p-2">
              <input
                type="color"
                value={l.color}
                onChange={(e) =>
                  void updateLabel(l.id, { color: e.target.value })
                }
                className="h-7 w-7 cursor-pointer rounded border"
              />
              <Input
                value={l.name}
                onChange={(e) => void updateLabel(l.id, { name: e.target.value })}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => void deleteLabel(l.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border"
            />
            <Input
              placeholder="New label"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={async () => {
                if (!newName.trim()) return;
                await createLabel({ name: newName.trim(), color: newColor });
                setNewName("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Task Card ===================
interface TaskCardProps {
  task: Task;
  labels: TaskLabel[];
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
}

function TaskCard({ task, labels, onClick, draggable, onDragStart }: TaskCardProps): ReactElement {
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition hover:border-primary/50 hover:shadow"
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_COLORS[task.priority]}`}
          title={task.priority}
        />
        <div className="flex-1">
          <p
            className={`text-sm font-medium ${
              task.status === "done" ? "text-muted-foreground line-through" : ""
            }`}
          >
            {task.title}
          </p>
          {task.dueAt && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Due {task.dueAt.toLocaleDateString()}
            </p>
          )}
          {task.labelIds.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {task.labelIds.map((id) => {
                const l = labelById.get(id);
                if (!l) return null;
                return (
                  <span
                    key={id}
                    className="rounded-full px-1.5 py-0.5 text-[10px] text-white"
                    style={{ backgroundColor: l.color }}
                  >
                    {l.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =================== Views ===================
interface ViewProps {
  tasks: Task[];
  labels: TaskLabel[];
  onOpen: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

function ListView({ tasks, labels, onOpen }: ViewProps): ReactElement {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tasks yet.</p>;
  }
  return (
    <div className="space-y-2 pr-4">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} labels={labels} onClick={() => onOpen(t)} />
      ))}
    </div>
  );
}

function BoardView({ tasks, labels, onOpen, onStatusChange }: ViewProps): ReactElement {
  const grouped: Record<TaskStatus, Task[]> = {
    todo: [],
    "in-progress": [],
    done: [],
    cancelled: []
  };
  for (const t of tasks) grouped[t.status].push(t);

  const handleDrop = (status: TaskStatus) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) onStatusChange(id, status);
  };

  return (
    <div className="grid grid-cols-4 gap-3 pr-4">
      {STATUSES.map((s) => (
        <div
          key={s}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop(s)}
          className="flex min-h-[200px] flex-col gap-2 rounded-lg border bg-muted/30 p-2"
        >
          <div className="mb-1 flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {STATUS_LABELS[s]}
            </h3>
            <span className="text-xs text-muted-foreground">{grouped[s].length}</span>
          </div>
          {grouped[s].map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              labels={labels}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
              onClick={() => onOpen(t)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CalendarView({ tasks, labels, onOpen }: ViewProps): ReactElement {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = (t.dueAt ?? t.startAt)?.toDateString();
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const monthName = month.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="pr-4">
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          ◀
        </Button>
        <span className="text-sm font-medium">{monthName}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          ▶
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-1 py-0.5 font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[80px]" />;
          const dayTasks = tasksByDay.get(day.toDateString()) ?? [];
          const isToday = sameDay(day, new Date());
          return (
            <div
              key={i}
              className={`min-h-[80px] rounded border p-1 ${
                isToday ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div className="text-xs font-medium">{day.getDate()}</div>
              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => {
                  const labelId = t.labelIds[0];
                  const label = labelId ? labels.find((l) => l.id === labelId) : null;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpen(t)}
                      className="w-full truncate rounded px-1 text-left text-[10px] text-white"
                      style={{ backgroundColor: label?.color ?? "#64748b" }}
                    >
                      {t.title}
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ tasks, labels, onOpen }: ViewProps): ReactElement {
  const today = new Date();
  const todays = tasks.filter((t) => {
    const d = t.startAt ?? t.dueAt;
    return d ? sameDay(d, today) : false;
  });
  const unscheduled = tasks.filter(
    (t) => !t.startAt && !t.dueAt && t.status !== "done" && t.status !== "cancelled"
  );

  const hourBucket = (h: number): Task[] =>
    todays.filter((t) => {
      const d = t.startAt ?? t.dueAt;
      return d ? d.getHours() === h : false;
    });

  return (
    <div className="grid grid-cols-2 gap-4 pr-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Today — {today.toLocaleDateString()}
        </h3>
        <div className="space-y-1">
          {Array.from({ length: 24 }, (_, h) => h).map((h) => (
            <div key={h} className="flex gap-2 border-b py-1">
              <div className="w-12 shrink-0 text-xs text-muted-foreground">
                {String(h).padStart(2, "0")}:00
              </div>
              <div className="flex-1 space-y-1">
                {hourBucket(h).map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    labels={labels}
                    onClick={() => onOpen(t)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Unscheduled</h3>
        <div className="space-y-2">
          {unscheduled.length === 0 ? (
            <p className="text-xs text-muted-foreground">All caught up.</p>
          ) : (
            unscheduled.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                labels={labels}
                onClick={() => onOpen(t)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// =================== Suggestion Bar ===================
function SuggestionBar(): ReactElement | null {
  const { suggestions, load, acceptSuggestion, dismissSuggestion } =
    useTaskSuggestionsStore();

  useEffect(() => {
    void load("pending");
  }, [load]);

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-50/40 p-3 dark:bg-amber-900/10">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Agent suggestions ({suggestions.length})
      </div>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded border bg-background p-2"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{s.title}</p>
              {s.description && (
                <p className="text-xs text-muted-foreground">{s.description}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void acceptSuggestion(s.id)}
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void dismissSuggestion(s.id)}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Dismiss
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =================== Main ===================
export function Tasks(): ReactElement {
  const { tasks, load, createTask, updateTask, deleteTask, setTaskStatus } =
    useTasksStore();
  const { labels, load: loadLabels } = useTaskLabelsStore();
  const [view, setView] = useState<ViewMode>("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);

  useEffect(() => {
    void load();
    void loadLabels();
  }, [load, loadLabels]);

  const handleSave = async (
    id: string | null,
    updates: UpdateTaskInput
  ): Promise<void> => {
    if (id) {
      await updateTask(id, updates);
    } else {
      await createTask({
        title: updates.title ?? "Untitled",
        description: updates.description ?? undefined,
        priority: updates.priority,
        startAt: updates.startAt ?? null,
        dueAt: updates.dueAt ?? null,
        labelIds: updates.labelIds
      });
      if (updates.status && updates.status !== "todo") {
        // freshly created task is "todo"; status updates can come later
      }
    }
  };

  const openNew = (): void => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openTask = (task: Task): void => {
    setEditing(task);
    setDialogOpen(true);
  };

  const viewProps: ViewProps = {
    tasks,
    labels,
    onOpen: openTask,
    onStatusChange: (id, status) => void setTaskStatus(id, status)
  };

  const ViewButton = ({ id, label }: { id: ViewMode; label: string }): ReactElement => (
    <Button
      variant={view === id ? "default" : "outline"}
      size="sm"
      onClick={() => setView(id)}
    >
      {label}
    </Button>
  );

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLabelManagerOpen(true)}>
            <Tag className="mr-1 h-4 w-4" /> Labels
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      <SuggestionBar />

      <div className="mb-4 flex gap-2">
        <ViewButton id="list" label="List" />
        <ViewButton id="board" label="Board" />
        <ViewButton id="calendar" label="Calendar" />
        <ViewButton id="day" label="Day" />
      </div>

      <ScrollArea className="h-[calc(100vh-260px)]">
        {view === "list" && <ListView {...viewProps} />}
        {view === "board" && <BoardView {...viewProps} />}
        {view === "calendar" && <CalendarView {...viewProps} />}
        {view === "day" && <DayView {...viewProps} />}
      </ScrollArea>

      <TaskDialog
        open={dialogOpen}
        task={editing}
        labels={labels}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        onDelete={async (id) => {
          await deleteTask(id);
        }}
      />

      <LabelManager open={labelManagerOpen} onClose={() => setLabelManagerOpen(false)} />
    </div>
  );
}
// Unused icon kept for future toolbar; prevent unused import warning.
void Pencil;

