import { useEffect, useMemo, useState, type ReactElement } from "react";
import { ArrowDown, ArrowUp, MessageSquare, Pencil, Plus, X } from "lucide-react";
import { useDashboardStore } from "@renderer/stores/useDashboardStore";
import { useChatStore } from "@renderer/stores/useChatStore";
import { listAllCardDefs, resolveCardDef } from "@renderer/components/cards/registry";
import { Button } from "@renderer/components/ui/button";
import { ChatPanel } from "@renderer/components/chat/ChatPanel";

export function Dashboard(): ReactElement {
  const { layout, extensions, load, addSlot, removeSlot, moveSlot, setSlotColSpan } =
    useDashboardStore();
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const slots = layout?.slots ?? [];

  const {
    sessions,
    activeSessionId,
    load: loadChat,
    createSession,
    attachStreamListener
  } = useChatStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (drawerOpen) void loadChat();
  }, [drawerOpen, loadChat]);

  useEffect(() => {
    if (!drawerOpen) return;
    const off = attachStreamListener();
    return off;
  }, [drawerOpen, attachStreamListener]);

  useEffect(() => {
    if (drawerOpen && sessions.length === 0) {
      void createSession({ title: "Dashboard chat" });
    }
  }, [drawerOpen, sessions.length, createSession]);

  const contextPayload = useMemo(
    () => ({
      view: "dashboard",
      date: new Date().toISOString(),
      cards: slots.map((s) => s.cardId)
    }),
    [slots]
  );

  const allDefs = useMemo(() => listAllCardDefs(extensions), [extensions]);
  const availableToAdd = useMemo(
    () => allDefs.filter((d) => !slots.some((s) => s.cardId === d.id)),
    [allDefs, slots]
  );

  return (
    <div className="relative h-full">
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{today}</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            {editing && (
              <div className="relative">
                <Button size="sm" variant="outline" onClick={() => setPickerOpen((v) => !v)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add card
                </Button>
                {pickerOpen && (
                  <div className="absolute right-0 z-50 mt-1 max-h-72 w-64 overflow-auto rounded-md border bg-popover shadow-lg">
                    {availableToAdd.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">
                        All cards already on the dashboard.
                      </p>
                    ) : (
                      availableToAdd.map((def) => (
                        <button
                          key={def.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-xs hover:bg-accent"
                          onClick={() => {
                            void addSlot(def.id, 1);
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
                    <span className="font-medium text-muted-foreground">{def.title}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-accent disabled:opacity-30"
                        disabled={index === 0}
                        onClick={() => void moveSlot(index, index - 1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-accent disabled:opacity-30"
                        disabled={index === slots.length - 1}
                        onClick={() => void moveSlot(index, index + 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="rounded px-1 text-[10px] font-semibold hover:bg-accent"
                        onClick={() =>
                          void setSlotColSpan(index, slot.colSpan === 2 ? 1 : 2)
                        }
                        aria-label="Toggle width"
                      >
                        {slot.colSpan === 2 ? "1×" : "2×"}
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-destructive hover:bg-destructive/10"
                        onClick={() => void removeSlot(index)}
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

      {/* Floating chat trigger — fixed bottom-right of the dashboard viewport. */}
      {!drawerOpen && (
        <Button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-30 h-12 w-12 rounded-full p-0 shadow-lg"
          aria-label="Open dashboard chat"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      )}

      {/* Side drawer with reusable ChatPanel + dashboard context payload. */}
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
            aria-label="Dashboard chat"
          >
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Dashboard chat</h2>
                <p className="text-[11px] text-muted-foreground">
                  Context-aware · sees your dashboard cards
                </p>
              </div>
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
            <div className="min-h-0 flex-1">
              <ChatPanel
                sessionId={activeSessionId}
                contextPayload={contextPayload}
                hideHeader
                onCreate={() => void createSession({ title: "Dashboard chat" })}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

