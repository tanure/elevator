import { useEffect, useState, type ReactElement } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Textarea } from "@renderer/components/ui/textarea";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { useNotesStore } from "@renderer/stores/useNotesStore";
import type { Note } from "@elevator/shared";

export function Notes(): ReactElement {
  const { notes, selectedId, load, createNote, updateNote, deleteNote, selectNote } =
    useNotesStore();
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  const selected: Note | null = notes.find((n) => n.id === selectedId) ?? null;

  // Sync editor when selection changes
  useEffect(() => {
    setEditTitle(selected?.title ?? "");
    setEditContent(selected?.content ?? "");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = (): void => {
    if (!selected) return;
    void updateNote(selected.id, { title: editTitle, content: editContent });
  };

  const handleCreate = (): void => {
    void createNote({ title: "Untitled", content: "" }).then((note) => selectNote(note.id));
  };

  return (
    <div className="flex h-screen">
      {/* Note list */}
      <div className="flex w-56 flex-col border-r">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-semibold">Notes</h2>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {notes.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No notes yet</p>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                type="button"
                className={`w-full truncate px-3 py-2 text-left text-sm transition-colors ${
                  note.id === selectedId
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={() => selectNote(note.id)}
              >
                {note.title || "Untitled"}
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Editor */}
      <div className="flex flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a note or create a new one
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b p-3">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSave}
                className="h-auto border-0 p-0 text-base font-semibold shadow-none focus-visible:ring-0"
                placeholder="Note title"
              />
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => void deleteNote(selected.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={handleSave}
              className="flex-1 resize-none rounded-none border-0 p-4 text-sm shadow-none focus-visible:ring-0"
              placeholder="Write your note..."
            />
          </>
        )}
      </div>
    </div>
  );
}
