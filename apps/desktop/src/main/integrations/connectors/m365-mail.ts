import type {
  ConnectorTemplate,
  IntegrationSyncData,
  MailMessage,
  ToolCallResult,
  ToolDescriptor
} from "@elevator/shared";
import type { Connector, ConnectorContext, ConnectorModule } from "../types.js";
import { setSyncCache } from "../cache.js";
import { ensureGraphConnect, graphFetch } from "../graph.js";

const SCOPES = ["Mail.Read", "User.Read"];

interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string;
  bodyPreview?: string;
  isRead: boolean;
  webLink?: string;
}

const TOOLS: ToolDescriptor[] = [
  {
    id: "m365mail.recent",
    integrationId: "m365-mail",
    name: "Recent mail",
    description: "Return the most recent messages from the user's inbox.",
    requiredPermissions: ["tool:execute"],
    inputSchema: { type: "object", properties: { top: { type: "number" } } }
  }
];

async function fetchMail(ctx: ConnectorContext, top: number): Promise<MailMessage[]> {
  const data = await graphFetch<{ value: GraphMessage[] }>(
    ctx,
    SCOPES,
    `/me/mailFolders/Inbox/messages`,
    {
      $top: String(Math.min(Math.max(top, 1), 50)),
      $orderby: "receivedDateTime desc",
      $select: "id,subject,from,receivedDateTime,bodyPreview,isRead,webLink"
    }
  );
  return data.value.map((m) => ({
    id: m.id,
    subject: m.subject ?? "(no subject)",
    from: m.from?.emailAddress?.name ?? m.from?.emailAddress?.address ?? "(unknown)",
    receivedAt: new Date(m.receivedDateTime).toISOString(),
    preview: m.bodyPreview ?? "",
    unread: !m.isRead,
    webLink: m.webLink
  }));
}

export const m365MailTemplate: ConnectorTemplate = {
  id: "m365-mail",
  name: "Microsoft 365 Mail",
  description:
    "Read recent messages from your Microsoft 365 inbox via Microsoft Graph. Uses OAuth + PKCE with a loopback redirect.",
  type: "api",
  authStyle: "oauth",
  supportsMultipleInstances: false,
  icon: "Mail",
  configSchema: [
    {
      key: "tenant",
      label: "Tenant",
      type: "string",
      required: false,
      defaultValue: "common",
      help: "Tenant id, domain, or 'common'."
    },
    {
      key: "clientId",
      label: "Application (client) id",
      type: "string",
      required: true,
      placeholder: "00000000-0000-0000-0000-000000000000"
    },
    {
      key: "topCount",
      label: "Messages to load",
      type: "number",
      required: false,
      defaultValue: 15,
      min: 1,
      max: 50
    }
  ],
  requiredPermissions: ["integration:connect"],
  networkTargets: ["login.microsoftonline.com", "graph.microsoft.com"]
};

export const m365MailConnector: Connector = {
  id: "m365-mail",
  name: "Microsoft 365 Mail",
  type: "api",

  async check(ctx) {
    try {
      const me = await graphFetch<{ displayName: string; userPrincipalName?: string }>(
        ctx,
        SCOPES,
        "/me"
      );
      return {
        ok: true,
        message: `Signed in as ${me.userPrincipalName ?? me.displayName}.`
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async connect(ctx) {
    return ensureGraphConnect(ctx, SCOPES);
  },

  listTools() {
    return TOOLS;
  },

  async callTool(ctx, toolId, input): Promise<ToolCallResult> {
    if (toolId !== "m365mail.recent") {
      return { ok: false, output: null, error: `Unknown tool: ${toolId}` };
    }
    const top = Number(input.top ?? ctx.config.topCount ?? 15);
    try {
      const mail = await fetchMail(ctx, top);
      return { ok: true, output: mail };
    } catch (err) {
      return {
        ok: false,
        output: null,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  },

  async sync(ctx): Promise<IntegrationSyncData> {
    const top = Number(ctx.config.topCount ?? 15);
    const mail = await fetchMail(ctx, top);
    const data: IntegrationSyncData = {
      integrationId: ctx.instanceId,
      kind: "mail",
      fetchedAt: new Date().toISOString(),
      mail
    };
    await setSyncCache(ctx.instanceId, data);
    return data;
  }
};

export const m365MailModule: ConnectorModule = {
  template: m365MailTemplate,
  connector: m365MailConnector
};
