import { useState, type ReactElement } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { useTasksStore } from "@renderer/stores/useTasksStore";
import { useNotesStore } from "@renderer/stores/useNotesStore";

export function QuickActionsCard(): ReactElement {
  const [taskTitle, setTaskTitle] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const { createTask } = useTasksStore();
  const { createNote } = useNotesStore();
  const navigate = useNavigate();

  const handleCreateTask = async (): Promise<void> => {
    if (!taskTitle.trim()) return;
    await createTask({ title: taskTitle.trim() });
    setTaskTitle("");
  };

  const handleCreateNote = async (): Promise<void> => {
    if (!noteTitle.trim()) return;
    await createNote({ title: noteTitle.trim(), content: "" });
    setNoteTitle("");
    void navigate("/notes");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4 text-primary" />
          Quick add
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-1.5">
          <Input
            placeholder="New task..."
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateTask();
            }}
            className="h-7 text-xs"
          />
          <Button size="sm" className="h-7 px-2" onClick={() => void handleCreateTask()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex gap-1.5">
          <Input
            placeholder="New note..."
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateNote();
            }}
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2"
            onClick={() => void handleCreateNote()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
