import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ChevronDown, ChevronRight, FolderPlus, Plus, Trash2 } from "lucide-react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block, PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { useNotesStore } from "@renderer/stores/useNotesStore";
import { useNoteFoldersStore } from "@renderer/stores/useNoteFoldersStore";
import type { Note, NoteFolder } from "@elevator/shared";

interface NoteEditorProps {
  note: Note;
  onChange: (blocks: Block[]) => void;
}

function NoteEditor({ note, onChange }: NoteEditorProps): ReactElement {
  const initial = useMemo<PartialBlock[] | undefined>(() => {
    const c = note.contentJson;
    return Array.isArray(c) && c.length > 0 ? (c as PartialBlock[]) : undefined;
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const editor = useCreateBlockNote({ initialContent: initial });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <BlockNoteView
      editor={editor}
      onChange={() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          onChange(editor.document);
        }, 400);
      }}
    />
  );
}

interface FolderNodeProps {
  folder: NoteFolder;
  childrenByParent: Map<string | null, NoteFolder[]>;
  selectedFolderId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDropNote: (noteId: string, folderId: string | null) => void;
}

function FolderNode({
  folder,
  childrenByParent,
  selectedFolderId,
  onSelect,
  onDelete,
  onDropNote
}: FolderNodeProps): ReactElement {
  const [open, setOpen] = useState(true);
  const kids = childrenByParent.get(folder.id) ?? [];
  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1 text-sm cursor-pointer ${
          selectedFolderId === folder.id
            ? "bg-primary text-primary-foreground"
            : "hover:bg-accent"
        }`}
        onClick={() => onSelect(folder.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const noteId = e.dataTransfer.getData("text/note-id");
          if (noteId) onDropNote(noteId, folder.id);
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          className="text-muted-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <span className="flex-1 truncate">{folder.name}</span>
        <button
          type="button"
          className="hidden h-4 w-4 text-muted-foreground hover:text-destructive group-hover:inline-flex"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(folder.id);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {open && kids.length > 0 && (
        <div className="ml-3 border-l pl-1">
          {kids.map((k) => (
            <FolderNode
              key={k.id}
              folder={k}
              childrenByParent={childrenByParent}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onDelete={onDelete}
              onDropNote={onDropNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Notes(): ReactElement {
  const { notes, selectedId, load, createNote, updateNote, deleteNote, selectNote } =
    useNotesStore();
  const {
    folders,
    load: loadFolders,
    createFolder,
    deleteFolder
  } = useNoteFoldersStore();
  const [editTitle, setEditTitle] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

  const selected: Note | null = notes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    setEditTitle(selected?.title ?? "");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const childrenByParent = useMemo(() => {
    const m = new Map<string | null, NoteFolder[]>();
    for (const f of folders) {
      const key = f.parentId ?? null;
      const arr = m.get(key) ?? [];
      arr.push(f);
      m.set(key, arr);
    }
    return m;
  }, [folders]);

  const visibleNotes = useMemo(() => {
    if (selectedFolderId === null) return notes;
    return notes.filter((n) => n.folderId === selectedFolderId);
  }, [notes, selectedFolderId]);

  const handleCreate = (): void => {
    void createNote({ title: "Untitled", contentJson: [], folderId: selectedFolderId }).then(
      (note) => selectNote(note.id)
    );
  };

  const handleNewFolder = (): void => {
    const name = window.prompt("Folder name");
    if (name && name.trim()) {
      void createFolder({ name: name.trim(), parentId: selectedFolderId });
    }
  };

  const handleDropNote = (noteId: string, folderId: string | null): void => {
    void updateNote(noteId, { folderId });
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar: folders + notes */}
      <div className="flex w-64 flex-col border-r">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-semibold">Notes</h2>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleNewFolder}
              title="New folder"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleCreate}
              title="New note"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div
            className={`px-2 py-1 text-sm cursor-pointer ${
              selectedFolderId === null
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
            onClick={() => setSelectedFolderId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const noteId = e.dataTransfer.getData("text/note-id");
              if (noteId) handleDropNote(noteId, null);
            }}
          >
            All notes
          </div>
          {(childrenByParent.get(null) ?? []).map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              childrenByParent={childrenByParent}
              selectedFolderId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onDelete={(id) => void deleteFolder(id)}
              onDropNote={handleDropNote}
            />
          ))}
          <div className="mt-2 border-t pt-1">
            {visibleNotes.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No notes</p>
            ) : (
              visibleNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/note-id", note.id)}
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
          </div>
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
                onBlur={() => void updateNote(selected.id, { title: editTitle })}
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
            <div className="flex-1 overflow-auto">
              <NoteEditor
                key={selected.id}
                note={selected}
                onChange={(blocks) =>
                  void updateNote(selected.id, { contentJson: blocks })
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
