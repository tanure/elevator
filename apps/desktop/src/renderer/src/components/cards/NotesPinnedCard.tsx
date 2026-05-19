import { useEffect, type ReactElement } from "react";
import { StickyNote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { useNotesStore } from "@renderer/stores/useNotesStore";

export function NotesPinnedCard(): ReactElement {
  const { notes, load } = useNotesStore();
  const navigate = useNavigate();

  useEffect(() => {
    void load();
  }, [load]);

  const pinned = notes.filter((n) => n.isPinned).slice(0, 4);

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50"
      onClick={() => void navigate("/notes")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <StickyNote className="h-4 w-4 text-primary" />
          Pinned notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pinned.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pinned notes</p>
        ) : (
          <ul className="space-y-1">
            {pinned.map((note) => (
              <li key={note.id} className="truncate text-xs text-muted-foreground">
                {note.title || "Untitled"}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
