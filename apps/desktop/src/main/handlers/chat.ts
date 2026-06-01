import { ipcMain } from "electron";
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatMessages,
  listChatSessions,
  updateChatSession
} from "@elevator/data";
import type {
  AgentTool,
  ChatMessage,
  ChatSendResult,
  ChatSession,
  CreateChatSessionInput,
  UpdateChatSessionInput
} from "@elevator/shared";
import { getDb } from "../db.js";
import { sendChatMessage } from "../ai/chat.js";
import { listAgentTools } from "../ai/tools.js";
import { getActiveProvider } from "../ai/registry.js";
import { getCopilotModel, hasCopilotToken } from "../ai/copilot-token.js";

export function registerChatHandlers(): void {
  ipcMain.handle("chat:listSessions", async (): Promise<ChatSession[]> => {
    return listChatSessions(getDb());
  });

  ipcMain.handle(
    "chat:getSession",
    async (_e, id: string): Promise<ChatSession | null> => {
      return getChatSession(getDb(), id);
    }
  );

  ipcMain.handle(
    "chat:createSession",
    async (_e, input: CreateChatSessionInput): Promise<ChatSession> => {
      // Default new sessions to the active provider rather than the DB default
      // ("echo"). When Copilot is configured we also pre-fill the persisted
      // default model so the session header / picker reflects what will run.
      const merged: CreateChatSessionInput = { ...(input ?? {}) };
      if (!merged.provider) {
        const active = getActiveProvider();
        merged.provider =
          active === "copilot" && !(await hasCopilotToken()) ? "echo" : active;
      }
      if (merged.provider === "copilot" && !merged.model) {
        try {
          merged.model = await getCopilotModel();
        } catch {
          /* fall through — leave model unset */
        }
      }
      return createChatSession(getDb(), merged);
    }
  );

  ipcMain.handle(
    "chat:updateSession",
    async (
      _e,
      id: string,
      input: UpdateChatSessionInput
    ): Promise<ChatSession | null> => {
      return updateChatSession(getDb(), id, input);
    }
  );

  ipcMain.handle("chat:deleteSession", async (_e, id: string): Promise<void> => {
    await deleteChatSession(getDb(), id);
  });

  ipcMain.handle(
    "chat:listMessages",
    async (_e, sessionId: string): Promise<ChatMessage[]> => {
      return listChatMessages(getDb(), sessionId);
    }
  );

  ipcMain.handle(
    "chat:send",
    async (
      _e,
      sessionId: string,
      content: string,
      contextPayload?: unknown
    ): Promise<ChatSendResult> => {
      return sendChatMessage(sessionId, content, contextPayload);
    }
  );

  ipcMain.handle("chat:listAvailableTools", async (): Promise<AgentTool[]> => {
    return listAgentTools();
  });
}
