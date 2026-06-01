import { create } from "zustand";
import type {
  AgentTool,
  ChatMessage,
  ChatSession,
  CreateChatSessionInput,
  UpdateChatSessionInput
} from "@elevator/shared";

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  availableTools: AgentTool[];
  sending: boolean;
  loading: boolean;
  error: string | null;
  /** Live in-flight assistant text for the active session, or null when idle. */
  streamingText: string | null;
  /** Session id of the in-flight stream, or null when idle. */
  streamingSessionId: string | null;

  load: () => Promise<void>;
  selectSession: (id: string | null) => Promise<void>;
  createSession: (input?: CreateChatSessionInput) => Promise<ChatSession>;
  updateSession: (id: string, input: UpdateChatSessionInput) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  send: (content: string, contextPayload?: unknown) => Promise<void>;
  /** Wire up the chat:stream listener. Returns an unsubscribe function. */
  attachStreamListener: () => () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  availableTools: [],
  sending: false,
  loading: false,
  error: null,
  streamingText: null,
  streamingSessionId: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [sessions, tools] = await Promise.all([
        window.elevator.chat.listSessions(),
        window.elevator.chat.listAvailableTools()
      ]);
      const current = get().activeSessionId;
      let next = current;
      if (!next && sessions.length > 0) next = sessions[0]!.id;
      set({ sessions, availableTools: tools });
      if (next !== get().activeSessionId) {
        await get().selectSession(next);
      } else if (next) {
        const messages = await window.elevator.chat.listMessages(next);
        set({ messages });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  selectSession: async (id) => {
    set({ activeSessionId: id, messages: [] });
    if (!id) return;
    try {
      const messages = await window.elevator.chat.listMessages(id);
      set({ messages });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  createSession: async (input) => {
    const session = await window.elevator.chat.createSession(input ?? {});
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
      messages: []
    }));
    return session;
  },

  updateSession: async (id, input) => {
    const updated = await window.elevator.chat.updateSession(id, input);
    if (!updated) return;
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? updated : s))
    }));
  },

  deleteSession: async (id) => {
    await window.elevator.chat.deleteSession(id);
    const wasActive = get().activeSessionId === id;
    const remaining = get().sessions.filter((s) => s.id !== id);
    set({ sessions: remaining });
    if (wasActive) {
      const nextId = remaining[0]?.id ?? null;
      await get().selectSession(nextId);
    }
  },

  send: async (content, contextPayload) => {
    const sessionId = get().activeSessionId;
    if (!sessionId) throw new Error("No active chat session");
    const trimmed = content.trim();
    if (!trimmed) return;
    set({
      sending: true,
      error: null,
      streamingText: "",
      streamingSessionId: sessionId
    });
    try {
      const { userMessage, assistantMessage } = await window.elevator.chat.send(
        sessionId,
        trimmed,
        contextPayload
      );
      set((state) => ({
        messages: [...state.messages, userMessage, assistantMessage]
      }));
      // Refresh sessions so the title (auto-named from first message) and
      // updatedAt ordering reflect on the sidebar.
      const sessions = await window.elevator.chat.listSessions();
      set({ sessions });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({
        sending: false,
        streamingText: null,
        streamingSessionId: null
      });
    }
  },

  attachStreamListener: () => {
    return window.elevator.chat.onStream((event) => {
      const active = get().activeSessionId;
      if (event.sessionId !== active) return;
      if (event.kind === "chunk") {
        set({ streamingText: event.text, streamingSessionId: event.sessionId });
      } else if (event.kind === "end" || event.kind === "error") {
        // `send` itself clears state on completion; nothing else to do here.
      }
    });
  }
}));
