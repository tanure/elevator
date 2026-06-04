import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Plus,
  Send,
  Settings,
  Wrench
} from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Badge } from "@renderer/components/ui/badge";
import { Textarea } from "@renderer/components/ui/textarea";
import { useChatStore } from "@renderer/stores/useChatStore";
import type {
  AgentToolCall,
  ChatMessage,
  ChatSession,
  CopilotModel
} from "@elevator/shared";

/**
 * Reusable chat surface (transcript + composer) for a single session. Pulls
 * state from the global chat store so only one panel is "active" at a time;
 * mounting with a specific `sessionId` switches the store to that session.
 *
 * Phase 5 (M11): consumers can pass `contextPayload` — an arbitrary JSON blob
 * (e.g. `{ view: "dashboard", date }`) — which is forwarded with every send and
 * prepended to the system prompt by the orchestrator.
 */
export function ChatPanel(props: {
  sessionId: string | null;
  contextPayload?: Record<string, unknown> | null;
  onCreate?: () => void;
  onOpenSettings?: () => void;
  /** Hide the header row (useful in tight drawers). */
  hideHeader?: boolean;
  /** Override empty-state CTA. Defaults to "New chat". */
  emptyAction?: ReactNode;
}): ReactElement {
  const {
    sessions,
    activeSessionId,
    messages,
    sending,
    error,
    streamingText,
    streamingSessionId,
    selectSession,
    send,
    createSession,
    updateSession
  } = useChatStore();

  // Switch the global active session to the one this panel was mounted for.
  useEffect(() => {
    if (props.sessionId && props.sessionId !== activeSessionId) {
      void selectSession(props.sessionId);
    }
  }, [props.sessionId, activeSessionId, selectSession]);

  const session = sessions.find((s) => s.id === props.sessionId) ?? null;
  const liveStream =
    streamingSessionId && streamingSessionId === props.sessionId
      ? streamingText
      : null;

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [models, setModels] = useState<CopilotModel[]>([]);

  // Lazily load the Copilot model catalog whenever the panel is showing a
  // copilot-backed session. Failures are non-fatal (user remains on whatever
  // model the session has).
  useEffect(() => {
    if (session?.provider !== "copilot") {
      setModels([]);
      return;
    }
    let cancelled = false;
    void window.elevator.copilot
      .listModels()
      .then((list) => {
        if (!cancelled) setModels(list);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.provider, session?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, streamingText]);

  if (!session) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No conversation selected</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Start a new chat to talk to the active AI provider. Conversations are
          stored locally in your Elevator database.
        </p>
        {props.emptyAction ?? (
          <Button onClick={() => (props.onCreate ? props.onCreate() : void createSession())}>
            <Plus className="mr-2 h-4 w-4" /> New chat
          </Button>
        )}
      </section>
    );
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    const value = draft.trim();
    if (!value || sending) return;
    setDraft("");
    void send(value, props.contextPayload ?? undefined);
  }

  return (
    <section className="flex h-full flex-col">
      {!props.hideHeader && (
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{session.title}</h1>
            <p className="text-xs text-muted-foreground">
              Provider: <span className="font-mono">{session.provider}</span>
              {session.model ? (
                <>
                  {" · "}
                  <span className="font-mono">{session.model}</span>
                </>
              ) : null}
              {session.allowedTools.length > 0 ? (
                <>
                  {" · "}
                  <span className="inline-flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    {session.allowedTools.length} tool
                    {session.allowedTools.length === 1 ? "" : "s"}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{messages.length} messages</Badge>
            {props.onOpenSettings && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={props.onOpenSettings}
                aria-label="Chat settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>
      )}

      <ProviderModelBar
        session={session}
        models={models}
        onChangeModel={(model) => void updateSession(session.id, { model })}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Send a message to start the conversation.
          </p>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {sending && liveStream !== null && liveStream.length > 0 && (
            <StreamingBubble text={liveStream} />
          )}
          {sending && (liveStream === null || liveStream.length === 0) && (
            <ThinkingIndicator />
          )}
        </div>
      </div>

      {error && (
        <div className="border-t bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t bg-card/40 px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Send a message…"
            rows={2}
            className="min-h-[44px] resize-y"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" disabled={sending || !draft.trim()}>
            <Send className="mr-1 h-4 w-4" /> Send
          </Button>
        </div>
        <p className="mx-auto mt-1 max-w-3xl text-xs text-muted-foreground">
          Enter to send · Shift+Enter for newline
        </p>
      </form>
    </section>
  );
}

// ── Message rendering helpers (also re-exported for the route shell) ─────────

function ProviderModelBar(props: {
  session: ChatSession;
  models: CopilotModel[];
  onChangeModel: (model: string | null) => void;
}): ReactElement {
  const { session, models, onChangeModel } = props;
  const currentModel = session.model ?? "";
  const { updateSession } = useChatStore();
  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-1.5 text-[11px]">
      <span className="text-muted-foreground">Provider</span>
      <span className="rounded bg-background px-1.5 py-0.5 font-mono">
        {session.provider}
      </span>
      {session.provider === "echo" && (
        <button
          type="button"
          className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary hover:bg-primary/20"
          onClick={() => void updateSession(session.id, { provider: "copilot" })}
          title="Switch this session to the Copilot provider"
        >
          ↑ Upgrade to Copilot
        </button>
      )}
      {session.provider === "copilot" && (
        <>
          <span className="text-muted-foreground">· Model</span>
          {models.length > 0 ? (
            <select
              aria-label="Model"
              value={currentModel}
              onChange={(e) => onChangeModel(e.target.value || null)}
              className="h-6 max-w-[180px] truncate rounded border bg-background px-1 font-mono text-[11px]"
            >
              <option value="">Default</option>
              {currentModel && !models.some((m) => m.id === currentModel) && (
                <option value={currentModel}>{currentModel} (current)</option>
              )}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.multiplier && m.multiplier !== 1 ? ` · ${m.multiplier}x` : ""}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-mono text-muted-foreground">
              {currentModel || "default"}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }): ReactElement {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const hasTools = message.toolCalls.length > 0;
  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start gap-2")}>
      {!isUser && <CopilotAvatar />}
      <div
        className={
          "max-w-[80%] rounded-lg px-3 py-2 text-sm " +
          (isUser
            ? "bg-primary text-primary-foreground"
            : isAssistant
              ? "bg-muted"
              : "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100")
        }
      >
        {isAssistant ? (
          <MarkdownBody content={message.content} />
        ) : !isUser ? (
          <>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium capitalize">{message.role}</span>
            </div>
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          </>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
        {hasTools && <ToolCallsBlock calls={message.toolCalls} />}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-bold text-foreground">
          You
        </div>
      )}
    </div>
  );
}

export function StreamingBubble({ text }: { text: string }): ReactElement {
  return (
    <div className="flex justify-start gap-2">
      <CopilotAvatar />
      <div className="max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm">
        <MarkdownBody content={text} />
        <span className="ml-0.5 inline-block h-4 w-[2px] animate-cursor-blink bg-foreground/70" />
      </div>
    </div>
  );
}

function ThinkingIndicator(): ReactElement {
  return (
    <div className="flex justify-start gap-2">
      <CopilotAvatar />
      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-4 py-3">
        <span className="inline-block h-2 w-2 animate-thinking-dot rounded-full bg-foreground/50" />
        <span className="inline-block h-2 w-2 animate-thinking-dot rounded-full bg-foreground/50 [animation-delay:0.2s]" />
        <span className="inline-block h-2 w-2 animate-thinking-dot rounded-full bg-foreground/50 [animation-delay:0.4s]" />
      </div>
    </div>
  );
}

function CopilotAvatar(): ReactElement {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-bold text-white shadow-sm">
      AI
    </div>
  );
}

export function MarkdownBody({ content }: { content: string }): ReactElement {
  return (
    <div className="markdown break-words text-sm leading-relaxed [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_pre]:my-2 [&_pre]:max-h-72 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-background/60 [&_pre]:p-2 [&_pre]:text-[12px] [&_table]:my-2 [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-border/60 [&_td]:px-2 [&_td]:py-0.5 [&_th]:border [&_th]:border-border/60 [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-0.5 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
              {...rest}
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ToolCallsBlock({ calls }: { calls: AgentToolCall[] }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left font-medium"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Wrench className="h-3.5 w-3.5" />
        Tool calls ({calls.length})
      </button>
      {open && (
        <ul className="space-y-2 border-t px-2 py-2">
          {calls.map((c, i) => (
            <li key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <code className="font-mono text-[11px]">{c.toolId}</code>
                <Badge variant={c.ok ? "outline" : "destructive"}>
                  {c.ok ? "ok" : "error"}
                </Badge>
              </div>
              <details className="rounded bg-muted/40 px-2 py-1">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">
                  input
                </summary>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px]">
                  {safeStringify(c.input)}
                </pre>
              </details>
              <details className="rounded bg-muted/40 px-2 py-1">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">
                  {c.ok ? "output" : "error"}
                </summary>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px]">
                  {c.ok ? safeStringify(c.output) : (c.error ?? "unknown error")}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export type { ChatSession };
