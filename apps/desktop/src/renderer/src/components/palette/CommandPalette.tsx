import { useEffect, useState, type ReactElement } from "react";
import {
  Bot,
  CheckSquare,
  LayoutDashboard,
  PlugZap,
  Settings,
  StickyNote,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@renderer/components/ui/command";
import { useAppStore } from "@renderer/stores/useAppStore";
import { useNotesStore } from "@renderer/stores/useNotesStore";
import { useTasksStore } from "@renderer/stores/useTasksStore";

export function CommandPalette(): ReactElement {
  const { paletteOpen, openPalette, closePalette } = useAppStore();
  const { notes } = useNotesStore();
  const { tasks } = useTasksStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // Listen for main-process Ctrl+K (IPC "palette:open")
  useEffect(() => {
    const unsubscribe = window.elevator.on.paletteOpen(openPalette);
    return unsubscribe;
  }, [openPalette]);

  // Local Ctrl+K fallback
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openPalette]);

  const go = (path: string): void => {
    void navigate(path);
    closePalette();
    setQuery("");
  };

  const q = query.toLowerCase();
  const filteredNotes = q
    ? notes
        .filter(
          (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
        )
        .slice(0, 5)
    : [];
  const filteredTasks = q
    ? tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 5)
    : [];

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={(open) => {
        if (!open) closePalette();
      }}
    >
      <CommandInput
        placeholder="Search or navigate..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found</CommandEmpty>

        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/notes")}>
            <StickyNote className="mr-2 h-4 w-4" />
            Notes
          </CommandItem>
          <CommandItem onSelect={() => go("/tasks")}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Tasks
          </CommandItem>
          <CommandItem onSelect={() => go("/integrations")}>
            <PlugZap className="mr-2 h-4 w-4" />
            Integrations
          </CommandItem>
          <CommandItem onSelect={() => go("/agents")}>
            <Bot className="mr-2 h-4 w-4" />
            Agents
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        {filteredNotes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notes">
              {filteredNotes.map((note) => (
                <CommandItem key={note.id} onSelect={() => go("/notes")}>
                  <StickyNote className="mr-2 h-4 w-4" />
                  {note.title || "Untitled"}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredTasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {filteredTasks.map((task) => (
                <CommandItem key={task.id} onSelect={() => go("/tasks")}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {task.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
