import { useEffect, useMemo, type ReactElement } from "react";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { ChatPanel } from "@renderer/components/chat/ChatPanel";
import { useChatStore } from "@renderer/stores/useChatStore";
import { useViewContext } from "./ViewContext";

/**
 * View-context card: embeds a compact chat panel pinned to the view's
 * `defaultChatSessionId`. If the view has no session yet, the empty-state
 * lives inside ChatPanel; the page-level wiring creates one on demand.
 */
export function ViewChatCard(): ReactElement {
  const view = useViewContext();
  const { attachStreamListener, load } = useChatStore();

  useEffect(() => {
    void load();
    const off = attachStreamListener();
    return off;
  }, [load, attachStreamListener]);

  const contextPayload = useMemo(
    () => ({
      view: view ? `view:${view.id}` : "view",
      viewName: view?.name,
      parameters: view?.parameters ?? {}
    }),
    [view]
  );

  return (
    <Card className="flex h-[420px] flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-primary" />
          {view?.name ? `${view.name} chat` : "Chat"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ChatPanel
          sessionId={view?.defaultChatSessionId ?? null}
          contextPayload={contextPayload}
          hideHeader
        />
      </CardContent>
    </Card>
  );
}
