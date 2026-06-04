import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, MessageSquare, Pencil, Plus, Save, Settings2, X } from "lucide-react";
import type { DashboardLayout, ViewRecord } from "@elevator/shared";
import { Button } from "@renderer/components/ui/button";
import { ChatPanel } from "@renderer/components/chat/ChatPanel";
import { useChatStore } from "@renderer/stores/useChatStore";
import { useExtensionsStore } from "@renderer/stores/useExtensionsStore";
import { useViewTemplatesStore } from "@renderer/stores/useViewTemplatesStore";
import { listAllCardDefs, resolveCardDef } from "@renderer/components/cards/registry";
import { ViewContext } from "@renderer/components/views/ViewContext";

export function ViewPage(): ReactElement {
  const { viewId } = useParams();
  const [view, setView] = useState<ViewRecord | null>(null);
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [chatInstructions, setChatInstructions] = useState("");

  const { extensions, load: loadExtensions } = useExtensionsStore();
  const { createFromView } = useViewTemplatesStore();
  const { createSession, deleteSession } =
    useChatStore();

  // ── Load view + layout ──────────────────────────────────────────────────
  const reload = async (): Promise<void> => {
    if (!viewId) return;
    setLoading(true);
    try {
      const v = await window.elevator.views.get(viewId);
      setView(v);
      setChatInstructions(v?.chatInstructions ?? "");
      if (v?.layoutId) {
        const l = await window.elevator.dashboardLayouts.get(v.layoutId);
        setLayout(l);
      } else {
        setLayout(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    void loadExtensions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  // Lazy chat session bootstrap: ensure the view has a default chat session.
  useEffect(() => {
    if (!view || !viewId) return;
    if (view.defaultChatSessionId) return;
    (async () => {
      const session = await createSession({ title: `${view.name} chat` });
      await window.elevator.views.update(viewId, {
        defaultChatSessionId: session.id
      });
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.id, view?.defaultChatSessionId]);

  // ── Layout mutations (persist immediately, then reload) ────────────────
  const persistSlots = async (
    nextSlots: { cardId: string; colSpan?: 1 | 2 }[]
  ): Promise<void> => {
    if (!layout) return;
    await window.elevator.dashboardLayouts.update(layout.id, {
      slots: nextSlots,
      isActive: true
    });
    setLayout({ ...layout, slots: nextSlots });
  };

  const slots = layout?.slots ?? [];

  const allDefs = useMemo(() => listAllCardDefs(extensions), [extensions]);
  const availableToAdd = useMemo(
    () => allDefs.filter((d) => !slots.some((s) => s.cardId === d.id)),
    [allDefs, slots]
  );

  const contextPayload = useMemo(
    () => ({
      view: view ? `view:${view.id}` : "view",
      viewName: view?.name,
      parameters: view?.parameters ?? {},
      cards: slots.map((s) => s.cardId)
    }),
    [view, slots]
  );

  const handleSaveAsTemplate = async (): Promise<void> => {
    if (!view) return;
    const name = window.prompt("Template name", `${view.name} template`);
    if (!name) return;
    const description = window.prompt("Description (optional)", "") ?? "";
    setSavingTemplate(true);
    try {
      await createFromView(view.id, { name, description });
      window.alert("Template saved.");
    } finally {
      setSavingTemplate(false);
    }
  };

  if (loading && !view) {
    return <div className="p-6 text-sm text-muted-foreground">Loading view…</div>;
  }

  if (!view) {
    return <div className="p-6 text-sm text-destructive">View not found.</div>;
  }

  return (
    <ViewContext.Provider value={view}>
      <div className="relative h-full">
        <div className="p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {view.groupName}
              </p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
                {view.name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={savingTemplate}
                onClick={() => void handleSaveAsTemplate()}
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                Save as template
              </Button>
              <Button
                size="sm"
                variant={instructionsOpen ? "default" : "outline"}
                onClick={() => setInstructionsOpen((v) => !v)}
                title="Chat instructions for this view"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
              {editing && (
                <div className="relative">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPickerOpen((v) => !v)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add card
                  </Button>
                  {pickerOpen && (
                    <div className="absolute right-0 z-50 mt-1 max-h-72 w-64 overflow-auto rounded-md border bg-popover shadow-lg">
                      {availableToAdd.length === 0 ? (
                        <p className="p-3 text-xs text-muted-foreground">
                          All cards already added.
                        </p>
                      ) : (
                        availableToAdd.map((def) => (
                          <button
                            key={def.id}
                            type="button"
                            className="block w-full px-3 py-2 text-left text-xs hover:bg-accent"
                            onClick={() => {
                              void persistSlots([
                                ...slots,
                                { cardId: def.id, colSpan: 1 }
                              ]);
                              setPickerOpen(false);
                            }}
                          >
                            {def.title}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              <Button
                size="sm"
                variant={editing ? "default" : "ghost"}
                onClick={() => {
                  setEditing((v) => !v);
                  setPickerOpen(false);
                }}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {editing ? "Done" : "Edit layout"}
              </Button>
            </div>
          </div>

          {instructionsOpen && (
            <div className="mb-4 rounded-md border bg-muted/30 p-4 space-y-2">
              <label className="text-sm font-medium" htmlFor="view-chat-instructions">
                Chat instructions for {view.name}
              </label>
              <textarea
                id="view-chat-instructions"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Instructions specific to this view's chat (e.g. customer context, rules, persona)…"
                value={chatInstructions}
                onChange={(e) => setChatInstructions(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    await window.elevator.views.update(viewId!, {
                      chatInstructions
                    });
                    setInstructionsOpen(false);
                  }}
                >
                  Save
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  These instructions are prepended to the chat system prompt when
                  chatting in this view.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {slots.map((slot, index) => {
              const def = resolveCardDef(slot.cardId, extensions);
              if (!def) return null;
              const { Component } = def;
              return (
                <div
                  key={`${slot.cardId}-${index}`}
                  className={slot.colSpan === 2 ? "col-span-2" : ""}
                >
                  {editing && (
                    <div className="mb-1 flex items-center justify-between rounded-md border border-dashed bg-muted/30 px-2 py-1 text-[11px]">
                      <span className="font-medium text-muted-foreground">
                        {def.title}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-accent disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => {
                            const next = [...slots];
                            const [m] = next.splice(index, 1);
                            if (m) next.splice(index - 1, 0, m);
                            void persistSlots(next);
                          }}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-accent disabled:opacity-30"
                          disabled={index === slots.length - 1}
                          onClick={() => {
                            const next = [...slots];
                            const [m] = next.splice(index, 1);
                            if (m) next.splice(index + 1, 0, m);
                            void persistSlots(next);
                          }}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="rounded px-1 text-[10px] font-semibold hover:bg-accent"
                          onClick={() => {
                            const next = slots.map((s, i) =>
                              i === index
                                ? { ...s, colSpan: s.colSpan === 2 ? 1 : 2 }
                                : s
                            ) as { cardId: string; colSpan?: 1 | 2 }[];
                            void persistSlots(next);
                          }}
                          aria-label="Toggle width"
                        >
                          {slot.colSpan === 2 ? "1×" : "2×"}
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            void persistSlots(
                              slots.filter((_, i) => i !== index)
                            )
                          }
                          aria-label="Remove card"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  <Component />
                </div>
              );
            })}
          </div>
        </div>

        {!drawerOpen && (
          <Button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-30 h-12 w-12 rounded-full p-0 shadow-lg"
            aria-label="Open view chat"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        )}

        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <aside
              className="fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-[100vw] flex-col border-l bg-background shadow-2xl"
              role="dialog"
              aria-label="View chat"
            >
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{view.name} chat</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Context-aware · sees this view's parameters
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title="New chat (clears current)"
                    onClick={async () => {
                      const oldId = view.defaultChatSessionId;
                      const session = await createSession({ title: `${view.name} chat` });
                      await window.elevator.views.update(viewId!, {
                        defaultChatSessionId: session.id
                      });
                      if (oldId) void deleteSession(oldId);
                      await reload();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <ChatPanel
                  sessionId={view.defaultChatSessionId}
                  contextPayload={contextPayload}
                  hideHeader
                />
              </div>
            </aside>
          </>
        )}
      </div>
    </ViewContext.Provider>
  );
}
