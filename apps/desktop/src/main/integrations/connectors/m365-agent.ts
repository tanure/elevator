import type {
  ConnectorTemplate,
  IntegrationSyncData,
  ToolCallResult,
  ToolDescriptor
} from "@elevator/shared";
import type { Connector, ConnectorContext, ConnectorModule } from "../types.js";
import { setSyncCache } from "../cache.js";
import { agentsFetch, ensureAgentsConnect, readAgentsConfig } from "../agents-api.js";

/**
 * Microsoft Agent 365 connector — Milestone 9 implementation.
 *
 * Provides tools to invoke Microsoft 365 Agents and observe their activity.
 * Only registered when `ELEVATOR_ENABLE_M365_AGENT=1` (see `registry.ts`).
 *
 * Design: docs/adr/ADR-0005-microsoft-agent-365.md
 */

const SCOPES = ["ChatMessage.Send", "Chat.ReadWrite", "User.Read"];

// ── Graph beta response shapes ─────────────────────────────────────────────

interface AgentThread {
  id: string;
  topic?: string;
  createdDateTime?: string;
  lastUpdatedDateTime?: string;
}

interface AgentMessage {
  id: string;
  createdDateTime: string;
  body: { contentType: string; content: string };
  from?: { user?: { displayName?: string }; application?: { displayName?: string } };
}

interface AgentThreadListResponse {
  value: AgentThread[];
}

interface AgentMessageListResponse {
  value: AgentMessage[];
}

// ── Sync payload shape (stored in cache `raw`) ─────────────────────────────

export interface AgentActivityPayload {
  type: "m365-agent.activity.v1";
  agentId: string;
  threads: Array<{
    id: string;
    topic: string;
    lastActivity: string;
    messageCount?: number;
  }>;
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: ToolDescriptor[] = [
  {
    id: "m365agent.invoke",
    integrationId: "m365-agent",
    name: "Invoke agent",
    description:
      "Send a message to the configured Microsoft 365 Agent and return its response. " +
      "Creates a new thread if threadId is not supplied.",
    requiredPermissions: ["tool:execute"],
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to send to the agent." },
        threadId: {
          type: "string",
          description: "Optional existing thread id. Omit to start a new conversation."
        }
      },
      required: ["message"]
    }
  },
  {
    id: "m365agent.threads.list",
    integrationId: "m365-agent",
    name: "List agent threads",
    description: "List recent conversation threads with the configured agent.",
    requiredPermissions: ["tool:execute"],
    inputSchema: {
      type: "object",
      properties: {
        top: { type: "number", description: "Max threads to return (1-50)." }
      }
    }
  },
  {
    id: "m365agent.threads.read",
    integrationId: "m365-agent",
    name: "Read agent thread",
    description: "Read messages from a specific agent conversation thread.",
    requiredPermissions: ["tool:execute"],
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "The thread id to read." }
      },
      required: ["threadId"]
    }
  }
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function agentBasePath(ctx: ConnectorContext): string {
  const cfg = readAgentsConfig(ctx, SCOPES);
  return `/me/chats`;
}

/**
 * Invoke the agent: create or continue a thread and wait for a response.
 * Microsoft 365 Agents are accessed through the Teams/chat substrate. The flow:
 * 1. Create a new chat (one-on-one with the agent app) or reuse threadId
 * 2. POST a message to the chat
 * 3. Poll briefly for an agent reply (agents respond asynchronously)
 */
async function invokeAgent(
  ctx: ConnectorContext,
  message: string,
  threadId?: string
): Promise<{ threadId: string; response: string; status: "completed" | "pending" }> {
  const cfg = readAgentsConfig(ctx, SCOPES);

  // Create a new chat thread with the agent if none provided
  if (!threadId) {
    const newChat = await agentsFetch<{ id: string }>(ctx, SCOPES, `/me/chats`, {
      method: "POST",
      body: {
        chatType: "oneOnOne",
        members: [
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": `https://graph.microsoft.com/beta/me`
          },
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["guest"],
            "user@odata.bind": `https://graph.microsoft.com/beta/users/${cfg.agentId}`
          }
        ]
      },
      maxRetries: 1
    });
    threadId = newChat.id;
  }

  // Send message
  await agentsFetch<AgentMessage>(ctx, SCOPES, `/me/chats/${threadId}/messages`, {
    method: "POST",
    body: {
      body: { contentType: "text", content: message }
    },
    maxRetries: 0
  });

  // Poll for agent response (up to 15 seconds with 3 second intervals)
  let agentReply: string | null = null;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const msgs = await agentsFetch<AgentMessageListResponse>(
      ctx,
      SCOPES,
      `/me/chats/${threadId}/messages`,
      { query: { $top: "5", $orderby: "createdDateTime desc" } }
    );
    const reply = msgs.value.find(
      (m) => m.from?.application?.displayName && !m.from?.user?.displayName
    );
    if (reply) {
      agentReply = reply.body.content;
      break;
    }
  }

  return {
    threadId: threadId!,
    response: agentReply ?? "",
    status: agentReply ? "completed" : "pending"
  };
}

async function listThreads(
  ctx: ConnectorContext,
  top: number
): Promise<AgentThread[]> {
  const data = await agentsFetch<AgentThreadListResponse>(ctx, SCOPES, agentBasePath(ctx), {
    query: { $top: String(Math.min(Math.max(top, 1), 50)), $orderby: "lastUpdatedDateTime desc" }
  });
  return data.value;
}

async function readThread(
  ctx: ConnectorContext,
  threadId: string
): Promise<AgentMessage[]> {
  const data = await agentsFetch<AgentMessageListResponse>(
    ctx,
    SCOPES,
    `/me/chats/${threadId}/messages`,
    { query: { $top: "50", $orderby: "createdDateTime asc" } }
  );
  return data.value;
}

// ── Template ────────────────────────────────────────────────────────────────

export const m365AgentTemplate: ConnectorTemplate = {
  id: "m365-agent",
  name: "Microsoft Agent 365",
  description:
    "Invoke and observe Microsoft 365 Agents from Elevator. " +
    "Requires an Entra app registration with Chat permissions and an Agent id.",
  type: "api",
  authStyle: "oauth",
  supportsMultipleInstances: false,
  icon: "Bot",
  configSchema: [
    {
      key: "tenant",
      label: "Entra tenant",
      type: "string",
      required: true,
      defaultValue: "common",
      placeholder: "common | organizations | <tenant-guid>"
    },
    {
      key: "clientId",
      label: "App registration client id",
      type: "string",
      required: true,
      placeholder: "00000000-0000-0000-0000-000000000000",
      help: "Your Entra app registration with Chat.ReadWrite and ChatMessage.Send delegated permissions."
    },
    {
      key: "agentId",
      label: "Agent id",
      type: "string",
      required: true,
      placeholder: "00000000-0000-0000-0000-000000000000",
      help: "The object id of the Microsoft 365 Agent (service principal) to invoke."
    },
    {
      key: "endpoint",
      label: "Agents endpoint override",
      type: "url",
      required: false,
      placeholder: "Optional — leave blank to use Graph beta",
      help: "Only Microsoft hosts are accepted (graph.microsoft.com, substrate.office.com, api.microsoft.com)."
    }
  ],
  requiredPermissions: ["integration:connect"],
  networkTargets: ["login.microsoftonline.com", "graph.microsoft.com"]
};

// ── Connector ───────────────────────────────────────────────────────────────

export const m365AgentConnector: Connector = {
  id: "m365-agent",
  name: "Microsoft Agent 365",
  type: "api",

  async check(ctx: ConnectorContext) {
    try {
      const me = await agentsFetch<{ displayName: string }>(ctx, SCOPES, "/me");
      return {
        ok: true,
        message: `Authorized as ${me.displayName}. Agent invocation depends on agent availability.`
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async connect(ctx: ConnectorContext) {
    return ensureAgentsConnect(ctx, SCOPES);
  },

  listTools(): ToolDescriptor[] {
    return TOOLS;
  },

  async callTool(ctx: ConnectorContext, toolId: string, input: Record<string, unknown>): Promise<ToolCallResult> {
    try {
      switch (toolId) {
        case "m365agent.invoke": {
          const message = String(input.message ?? "");
          if (!message) return { ok: false, output: null, error: "message is required." };
          const result = await invokeAgent(ctx, message, input.threadId as string | undefined);
          return { ok: true, output: result };
        }
        case "m365agent.threads.list": {
          const top = Number(input.top ?? 10);
          const threads = await listThreads(ctx, top);
          return { ok: true, output: threads };
        }
        case "m365agent.threads.read": {
          const threadId = String(input.threadId ?? "");
          if (!threadId) return { ok: false, output: null, error: "threadId is required." };
          const messages = await readThread(ctx, threadId);
          return {
            ok: true,
            output: messages.map((m) => ({
              id: m.id,
              createdAt: m.createdDateTime,
              content: m.body.content,
              from: m.from?.user?.displayName ?? m.from?.application?.displayName ?? "unknown"
            }))
          };
        }
        default:
          return { ok: false, output: null, error: `Unknown tool: ${toolId}` };
      }
    } catch (err) {
      return {
        ok: false,
        output: null,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  },

  async sync(ctx: ConnectorContext): Promise<IntegrationSyncData> {
    const cfg = readAgentsConfig(ctx, SCOPES);
    let threads: AgentThread[] = [];
    try {
      threads = await listThreads(ctx, 10);
    } catch {
      // Sync best-effort: return empty if not authorized or API unavailable
    }
    const payload: AgentActivityPayload = {
      type: "m365-agent.activity.v1",
      agentId: cfg.agentId,
      threads: threads.map((t) => ({
        id: t.id,
        topic: t.topic ?? "(no topic)",
        lastActivity: t.lastUpdatedDateTime ?? t.createdDateTime ?? new Date().toISOString()
      }))
    };
    const data: IntegrationSyncData = {
      integrationId: ctx.instanceId,
      kind: "custom",
      fetchedAt: new Date().toISOString(),
      raw: payload
    };
    await setSyncCache(ctx.instanceId, data);
    return data;
  }
};

export const m365AgentModule: ConnectorModule = {
  template: m365AgentTemplate,
  connector: m365AgentConnector
};
