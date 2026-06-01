import type {
  CalendarEvent,
  ConnectorTemplate,
  IntegrationSyncData,
  ToolCallResult,
  ToolDescriptor
} from "@elevator/shared";
import type { Connector, ConnectorContext, ConnectorModule } from "../types.js";
import { setSyncCache } from "../cache.js";
import { ensureGraphConnect, graphFetch } from "../graph.js";

const SCOPES = ["Calendars.Read", "User.Read"];

interface GraphEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  location?: { displayName?: string };
  webLink?: string;
  organizer?: { emailAddress?: { name?: string; address?: string } };
}

const TOOLS: ToolDescriptor[] = [
  {
    id: "m365cal.upcoming",
    integrationId: "m365-calendar",
    name: "Upcoming events",
    description: "Return events from the user's primary calendar in the next N days.",
    requiredPermissions: ["tool:execute"],
    inputSchema: { type: "object", properties: { days: { type: "number" } } }
  }
];

const CONTEXT_PROVIDERS: ToolDescriptor[] = [
  {
    id: "m365cal.today_agenda",
    integrationId: "m365-calendar",
    name: "Today's agenda",
    description: "Auto-context: events on the user's calendar for today.",
    requiredPermissions: ["tool:execute"],
    inputSchema: { type: "object", properties: {} },
    kind: "context"
  }
];

async function fetchEvents(ctx: ConnectorContext, days: number): Promise<CalendarEvent[]> {
  const start = new Date();
  const end = new Date(Date.now() + days * 86_400_000);
  const data = await graphFetch<{ value: GraphEvent[] }>(
    ctx,
    SCOPES,
    `/me/calendarView`,
    {
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      $orderby: "start/dateTime",
      $top: "50"
    }
  );
  return data.value.map((e) => ({
    id: e.id,
    title: e.subject ?? "(no subject)",
    start: new Date(`${e.start.dateTime}Z`).toISOString(),
    end: new Date(`${e.end.dateTime}Z`).toISOString(),
    allDay: e.isAllDay,
    location: e.location?.displayName,
    url: e.webLink,
    organizer: e.organizer?.emailAddress?.name ?? e.organizer?.emailAddress?.address
  }));
}

export const m365CalendarTemplate: ConnectorTemplate = {
  id: "m365-calendar",
  name: "Microsoft 365 Calendar",
  description:
    "Read your primary Microsoft 365 calendar via Microsoft Graph. Uses OAuth + PKCE with a loopback redirect; you supply your own app registration's client id.",
  type: "api",
  authStyle: "oauth",
  supportsMultipleInstances: false,
  icon: "CalendarCheck",
  configSchema: [
    {
      key: "tenant",
      label: "Tenant",
      type: "string",
      required: false,
      defaultValue: "common",
      help: "Tenant id, domain, or 'common' for the multi-tenant endpoint."
    },
    {
      key: "clientId",
      label: "Application (client) id",
      type: "string",
      required: true,
      placeholder: "00000000-0000-0000-0000-000000000000",
      help:
        "Your Azure AD app registration. Add http://127.0.0.1/callback as a redirect URI of type 'Public client/native'."
    },
    {
      key: "lookaheadDays",
      label: "Lookahead window (days)",
      type: "number",
      required: false,
      defaultValue: 7,
      min: 1,
      max: 60
    }
  ],
  requiredPermissions: ["integration:connect"],
  networkTargets: ["login.microsoftonline.com", "graph.microsoft.com"]
};

export const m365CalendarConnector: Connector = {
  id: "m365-calendar",
  name: "Microsoft 365 Calendar",
  type: "api",

  async check(ctx) {
    try {
      const me = await graphFetch<{ displayName: string }>(ctx, SCOPES, "/me");
      return { ok: true, message: `Signed in as ${me.displayName}.` };
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

  listContextProviders() {
    return CONTEXT_PROVIDERS;
  },

  async callTool(ctx, toolId, input): Promise<ToolCallResult> {
    if (toolId === "m365cal.today_agenda") {
      try {
        const events = await fetchEvents(ctx, 1);
        const today = new Date().toISOString().slice(0, 10);
        return {
          ok: true,
          output: events.filter((e) => e.start.slice(0, 10) === today)
        };
      } catch (err) {
        return {
          ok: false,
          output: null,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    }
    if (toolId !== "m365cal.upcoming") {
      return { ok: false, output: null, error: `Unknown tool: ${toolId}` };
    }
    const days = Number(input.days ?? ctx.config.lookaheadDays ?? 7);
    try {
      const events = await fetchEvents(ctx, days);
      return { ok: true, output: events };
    } catch (err) {
      return {
        ok: false,
        output: null,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  },

  async sync(ctx): Promise<IntegrationSyncData> {
    const days = Number(ctx.config.lookaheadDays ?? 7);
    const events = await fetchEvents(ctx, days);
    const data: IntegrationSyncData = {
      integrationId: ctx.instanceId,
      kind: "calendar",
      fetchedAt: new Date().toISOString(),
      events
    };
    await setSyncCache(ctx.instanceId, data);
    return data;
  }
};

export const m365CalendarModule: ConnectorModule = {
  template: m365CalendarTemplate,
  connector: m365CalendarConnector
};
