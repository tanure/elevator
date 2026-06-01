import { useEffect, useMemo, type ReactElement } from "react";
import { CheckSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { useTasksStore } from "@renderer/stores/useTasksStore";
import { useTaskLabelsStore } from "@renderer/stores/useTaskLabelsStore";
import { useViewContext } from "./ViewContext";

/**
 * View-context card: shows tasks whose labels contain a label matching
 * the view's `customerName` parameter (case-insensitive label name).
 */
export function ViewFilteredTasksCard(): ReactElement {
  const view = useViewContext();
  const { tasks, load: loadTasks } = useTasksStore();
  const { labels, load: loadLabels } = useTaskLabelsStore();
  const navigate = useNavigate();

  useEffect(() => {
    void loadTasks();
    void loadLabels();
  }, [loadTasks, loadLabels]);

  const filter = String(view?.parameters.customerName ?? "").toLowerCase();

  const matchedLabelIds = useMemo(() => {
    if (!filter) return new Set<string>();
    return new Set(
      labels.filter((l) => l.name.toLowerCase() === filter).map((l) => l.id)
    );
  }, [labels, filter]);

  const filtered = useMemo(() => {
    if (matchedLabelIds.size === 0) return [];
    return tasks
      .filter(
        (t) =>
          t.status !== "done" && t.labelIds.some((id) => matchedLabelIds.has(id))
      )
      .slice(0, 6);
  }, [tasks, matchedLabelIds]);

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50"
      onClick={() => void navigate("/tasks")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CheckSquare className="h-4 w-4 text-primary" />
          Tasks{filter ? ` · ${filter}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!filter ? (
          <p className="text-xs text-muted-foreground">No customer set.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No matching tasks.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((task) => (
              <li key={task.id} className="truncate text-xs text-muted-foreground">
                {task.title}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
