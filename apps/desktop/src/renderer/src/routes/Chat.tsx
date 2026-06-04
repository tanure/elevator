import {
  useEffect,
  useMemo,
  useState,
  type ReactElement
} from "react";
import {
  MessageSquare,
  Plus,
  Trash2
} from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Textarea } from "@renderer/components/ui/textarea";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ui/dialog";
import { ChatPanel } from "@renderer/components/chat/ChatPanel";
import { useChatStore } from "@renderer/stores/useChatStore";
import { useAgentsStore } from "@renderer/stores/useAgentsStore";
import type {
  AgentRecord,
  AgentTool,
  ChatSession,
  CopilotModel
} from "@elevator/shared";

export function Chat(): ReactElement {
  const {
    sessions,
    activeSessionId,
    availableTools,
    load,
    selectSession,
    createSession,
    updateSession,
    deleteSession
  } = useChatStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const { agents, load: loadAgents } = useAgentsStore();

  useEffect(() => {
    void load();
    void loadAgents();
  }, [load, loadAgents]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );

  return (
    <div className="grid h-full grid-cols-[260px_1fr]">
      <ChatSidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={(id) => void selectSession(id)}
        onCreate={() => void createSession()}
        onDelete={(id) => {
          if (confirm("Delete this conversation?")) void deleteSession(id);
        }}
      />
      <ChatPanel
        sessionId={activeSessionId}
        onCreate={() => void createSession()}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {activeSession && (
        <SessionSettingsDialog
          open={settingsOpen}
          session={activeSession}
          availableTools={availableTools}
          agents={agents}
          onClose={() => setSettingsOpen(false)}
          onSave={async (patch) => {
            await updateSession(activeSession.id, patch);
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function ChatSidebar(props: {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}): ReactElement {
  return (
    <aside className="flex h-full flex-col border-r bg-card/50">
      <div className="flex items-center justify-between border-b px-3 py-3">
        <h2 className="text-sm font-semibold">Chats</h2>
        <Button size="sm" variant="outline" onClick={props.onCreate}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <ul className="space-y-0.5 p-2">
          {props.sessions.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              No conversations yet.
            </li>
          )}
          {props.sessions.map((s) => {
            const active = s.id === props.activeId;
            return (
              <li key={s.id}>
                <div
                  className={
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm " +
                    (active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent")
                  }
                >
                  <button
                    type="button"
                    onClick={() => props.onSelect(s.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete chat"
                    onClick={() => props.onDelete(s.id)}
                    className={
                      "rounded p-1 opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100 " +
                      (active ? "text-primary-foreground" : "text-muted-foreground")
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </aside>
  );
}

// ── Settings dialog ──────────────────────────────────────────────────────────

function SessionSettingsDialog(props: {
  open: boolean;
  session: ChatSession;
  availableTools: AgentTool[];
  agents: AgentRecord[];
  onClose: () => void;
  onSave: (patch: {
    title: string;
    systemPrompt: string;
    allowedTools: string[];
    maxToolCalls: number;
    agentId: string | null;
    model: string | null;
  }) => Promise<void>;
}): ReactElement {
  const [title, setTitle] = useState(props.session.title);
  const [systemPrompt, setSystemPrompt] = useState(props.session.systemPrompt);
  const [allowed, setAllowed] = useState<string[]>(props.session.allowedTools);
  const [maxToolCalls, setMaxToolCalls] = useState<number>(
    props.session.maxToolCalls
  );
  const [agentId, setAgentId] = useState<string | null>(props.session.agentId);
  const [model, setModel] = useState<string>(props.session.model ?? "");
  const [models, setModels] = useState<CopilotModel[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.open) {
      setTitle(props.session.title);
      setSystemPrompt(props.session.systemPrompt);
      setAllowed(props.session.allowedTools);
      setMaxToolCalls(props.session.maxToolCalls);
      setAgentId(props.session.agentId);
      setModel(props.session.model ?? "");
      // Load model list lazily — copilot provider only. Failures are
      // non-fatal: the user can still type a model id by hand.
      if (props.session.provider === "copilot") {
        void window.elevator.copilot
          .listModels()
          .then(setModels)
          .catch(() => setModels([]));
      } else {
        setModels([]);
      }
    }
  }, [props.open, props.session]);

  function toggleTool(id: string): void {
    setAllowed((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      await props.onSave({
        title: title.trim() || "New chat",
        systemPrompt,
        allowedTools: allowed,
        maxToolCalls,
        agentId,
        model: model.trim() ? model.trim() : null
      });
    } finally {
      setSaving(false);
    }
  }

  const boundAgent = agentId
    ? props.agents.find((a) => a.id === agentId) ?? null
    : null;

  return (
    <Dialog open={props.open} onOpenChange={(o) => (o ? null : props.onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chat settings</DialogTitle>
          <DialogDescription>
            Configure the title, system prompt, and tools available to this
            conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="chat-title">Title</Label>
            <Input
              id="chat-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chat-agent">Agent</Label>
            <select
              id="chat-agent"
              aria-label="Agent"
              value={agentId ?? ""}
              onChange={(e) => setAgentId(e.target.value || null)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">None</option>
              {props.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {boundAgent && (
              <p className="text-xs text-muted-foreground">
                Inherits from <strong>{boundAgent.name}</strong>. The agent’s
                system prompt and goal are prepended to this session’s prompt;
                tools below override the agent’s allowed tools when set.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chat-model">Model</Label>
            {models.length > 0 ? (
              <select
                id="chat-model"
                aria-label="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Default (from Settings)</option>
                {model && !models.some((m) => m.id === model) && (
                  <option value={model}>{model} (current)</option>
                )}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.multiplier && m.multiplier !== 1
                      ? ` · ${m.multiplier}x`
                      : ""}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="chat-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Default (from Settings)"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Overrides the default model for this conversation only.
              {props.session.provider === "copilot" && models.length === 0
                ? " Sign in via Settings → AI to load the list."
                : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chat-system">System prompt</Label>
            <Textarea
              id="chat-system"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              placeholder="Optional instructions for the assistant…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chat-max-tools">Max tool calls per turn</Label>
            <Input
              id="chat-max-tools"
              type="number"
              min={0}
              max={20}
              value={maxToolCalls}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                setMaxToolCalls(Number.isFinite(n) ? n : 5);
              }}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              0–20. The chat aborts if the provider exceeds this many tool calls.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Allowed tools ({allowed.length})</Label>
            {props.availableTools.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tools available. Configure integrations to expose tools here.
              </p>
            ) : (
              <ScrollArea className="h-56 rounded-md border">
                <ul className="space-y-1 p-2">
                  {props.availableTools.map((tool) => {
                    const checked = allowed.includes(tool.id);
                    return (
                      <li key={tool.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded p-1.5 hover:bg-accent">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTool(tool.id)}
                            className="mt-1"
                          />
                          <span className="flex-1">
                            <span className="block font-mono text-xs">
                              {tool.id}
                            </span>
                            {tool.description && (
                              <span className="block text-xs text-muted-foreground">
                                {tool.description}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={props.onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
