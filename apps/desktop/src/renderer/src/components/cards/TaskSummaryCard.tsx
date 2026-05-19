import { useEffect, type ReactElement } from "react";
import { CheckSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Badge } from "@renderer/components/ui/badge";
import { useTasksStore } from "@renderer/stores/useTasksStore";

export function TaskSummaryCard(): ReactElement {
  const { tasks, load } = useTasksStore();
  const navigate = useNavigate();

  useEffect(() => {
    void load();
  }, [load]);

  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in-progress").length;
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50"
      onClick={() => void navigate("/tasks")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CheckSquare className="h-4 w-4 text-primary" />
          Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{todo} to do</Badge>
          <Badge variant="secondary">{inProgress} in progress</Badge>
          <Badge className="border-0 bg-primary/20 text-primary">{done} done</Badge>
        </div>
        {tasks.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No tasks yet</p>}
      </CardContent>
    </Card>
  );
}
