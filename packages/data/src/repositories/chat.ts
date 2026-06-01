import { asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type {
  AgentToolCall,
  AiProviderName,
  ChatMessage,
  ChatMessageRole,
  ChatSession,
  CreateChatSessionInput,
  UpdateChatSessionInput
} from "@elevator/shared";
import type { ElevatorDb } from "../db.js";
import { chatMessages, chatSessions } from "../schema.js";

function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseToolCalls(raw: string | null | undefined): AgentToolCall[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as AgentToolCall[]) : [];
  } catch {
    return [];
  }
}

function rowToSession(row: typeof chatSessions.$inferSelect): ChatSession {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider as AiProviderName,
    model: row.model ?? null,
    systemPrompt: row.systemPrompt,
    allowedTools: parseStringArray(row.allowedTools),
    maxToolCalls: row.maxToolCalls,
    agentId: row.agentId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function rowToMessage(row: typeof chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as ChatMessageRole,
    content: row.content,
    provider: (row.provider as AiProviderName | null) ?? null,
    model: row.model ?? null,
    toolCalls: parseToolCalls(row.toolCalls),
    createdAt: row.createdAt
  };
}

export async function listChatSessions(db: ElevatorDb): Promise<ChatSession[]> {
  const rows = await db
    .select()
    .from(chatSessions)
    .orderBy(desc(chatSessions.updatedAt));
  return rows.map(rowToSession);
}

export async function getChatSession(
  db: ElevatorDb,
  id: string
): Promise<ChatSession | null> {
  const rows = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
  return rows[0] ? rowToSession(rows[0]) : null;
}

export async function createChatSession(
  db: ElevatorDb,
  input: CreateChatSessionInput
): Promise<ChatSession> {
  const now = new Date();
  const row = {
    id: randomUUID(),
    title: input.title?.trim() || "New chat",
    provider: (input.provider ?? "echo") as AiProviderName,
    model: input.model ?? null,
    systemPrompt: input.systemPrompt ?? "",
    allowedTools: JSON.stringify(input.allowedTools ?? []),
    maxToolCalls: clampMaxToolCalls(input.maxToolCalls ?? 5),
    agentId: input.agentId ?? null,
    createdAt: now,
    updatedAt: now
  };
  await db.insert(chatSessions).values(row);
  return rowToSession(row);
}

export async function updateChatSession(
  db: ElevatorDb,
  id: string,
  input: UpdateChatSessionInput
): Promise<ChatSession | null> {
  const patch: Partial<typeof chatSessions.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.provider !== undefined) patch.provider = input.provider;
  if (input.model !== undefined) patch.model = input.model;
  if (input.systemPrompt !== undefined) patch.systemPrompt = input.systemPrompt;
  if (input.allowedTools !== undefined)
    patch.allowedTools = JSON.stringify(input.allowedTools);
  if (input.maxToolCalls !== undefined)
    patch.maxToolCalls = clampMaxToolCalls(input.maxToolCalls);
  if (input.agentId !== undefined) patch.agentId = input.agentId;
  await db.update(chatSessions).set(patch).where(eq(chatSessions.id, id));
  return getChatSession(db, id);
}

export async function touchChatSession(db: ElevatorDb, id: string): Promise<void> {
  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, id));
}

export async function deleteChatSession(db: ElevatorDb, id: string): Promise<void> {
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, id));
  await db.delete(chatSessions).where(eq(chatSessions.id, id));
}

export async function listChatMessages(
  db: ElevatorDb,
  sessionId: string
): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
  return rows.map(rowToMessage);
}

export interface AppendChatMessageInput {
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  provider?: AiProviderName | null;
  model?: string | null;
  toolCalls?: AgentToolCall[];
}

export async function appendChatMessage(
  db: ElevatorDb,
  input: AppendChatMessageInput
): Promise<ChatMessage> {
  const row = {
    id: randomUUID(),
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    provider: input.provider ?? null,
    model: input.model ?? null,
    toolCalls:
      input.toolCalls && input.toolCalls.length > 0
        ? JSON.stringify(input.toolCalls)
        : null,
    createdAt: new Date()
  };
  await db.insert(chatMessages).values(row);
  return rowToMessage(row);
}

function clampMaxToolCalls(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(20, Math.floor(n)));
}
