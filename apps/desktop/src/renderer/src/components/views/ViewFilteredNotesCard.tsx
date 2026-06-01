import { useEffect, useMemo, type ReactElement } from "react";
import { StickyNote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { useNotesStore } from "@renderer/stores/useNotesStore";
import { useViewContext } from "./ViewContext";

/**
 * View-context card: shows notes whose tags include the view's
 * `customerName` parameter (case-insensitive). Used by the "Customer"
 * built-in template.
 */
export function ViewFilteredNotesCard(): ReactElement {
  const view = useViewContext();
  const { notes, load } = useNotesStore();
  const navigate = useNavigate();

  useEffect(() => {
    void load();
  }, [load]);

  const filter = String(view?.parameters.customerName ?? "").toLowerCase();
  const filtered = useMemo(() => {
    if (!filter) return [];
    return notes
      .filter((n) => n.tags.some((t) => t.toLowerCase() === filter))
      .slice(0, 6);
  }, [notes, filter]);

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50"
      onClick={() => void navigate("/notes")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <StickyNote className="h-4 w-4 text-primary" />
          Notes{filter ? ` · #${filter}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!filter ? (
          <p className="text-xs text-muted-foreground">No customer set.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tagged notes.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((note) => (
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
