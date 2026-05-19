import { promises as fs } from "node:fs";
import type {
  ConnectorTemplate,
  IntegrationSyncData,
  ToolCallResult,
  ToolDescriptor
} from "@elevator/shared";
import type { Connector, ConnectorContext, ConnectorModule } from "../types.js";
import { parseIcs } from "../ics.js";
import { getSyncCache, setSyncCache } from "../cache.js";

const TOOLS: ToolDescriptor[] = [
  {
    id: "ics.upcoming",
    integrationId: "ics",
    name: "List upcoming events",
    description: "Return calendar events from the ICS feed within the next N days.",
    requiredPermissions: ["tool:execute"],
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", minimum: 1, maximum: 60 } }
    }
  }
];

async function loadIcs(source: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source, {
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" }
    });
    if (!res.ok) throw new Error(`ICS HTTP ${res.status} for ${source}`);
    return res.text();
  }
  return fs.readFile(source, "utf8");
}

function withinDays<T extends { start: string }>(events: T[], days: number): T[] {
  const cutoff = Date.now() + days * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return events.filter((e) => {
    const t = new Date(e.start).getTime();
    return t >= now && t <= cutoff;
  });
}

export const icsTemplate: ConnectorTemplate = {
  id: "ics",
  name: "ICS calendar feed",
  description:
    "Read-only calendar sync from a local .ics file or HTTPS calendar feed URL.",
  type: "api",
  authStyle: "none",
  supportsMultipleInstances: true,
  icon: "Calendar",
  configSchema: [
    {
      key: "source",
      label: "ICS file path or URL",
      type: "string",
      required: true,
      placeholder: "https://calendar.example.com/feeds/me.ics",
      help: "Local file path (C:\\…\\me.ics) or an https:// calendar feed URL."
    },
    {
      key: "lookaheadDays",
      label: "Lookahead window (days)",
      type: "number",
      required: false,
      defaultValue: 14,
      min: 1,
      max: 60
    }
  ],
  requiredPermissions: ["integration:connect"],
  networkTargets: ["the ICS feed host you configure"]
};

export const icsConnector: Connector = {
  id: "ics",
  name: "ICS calendar feed",
  type: "api",

  async check(ctx) {
    const source = String(ctx.config.source ?? "");
    if (!source) return { ok: false, message: "ICS source is required." };
    try {
      const text = await loadIcs(source);
      const events = parseIcs(text);
      return { ok: true, message: `Parsed ${events.length} events.` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  listTools() {
    return TOOLS;
  },

  async callTool(ctx, toolId, input): Promise<ToolCallResult> {
    if (toolId !== "ics.upcoming") {
      return { ok: false, output: null, error: `Unknown tool: ${toolId}` };
    }
    const days = Number(input.days ?? ctx.config.lookaheadDays ?? 14);
    const cached = await getSyncCache(ctx.instanceId);
    if (cached?.events) {
      return { ok: true, output: withinDays(cached.events, days) };
    }
    // Fallback to fresh fetch if no cache.
    const text = await loadIcs(String(ctx.config.source));
    const events = parseIcs(text);
    return { ok: true, output: withinDays(events, days) };
  },

  async sync(ctx): Promise<IntegrationSyncData> {
    const source = String(ctx.config.source ?? "");
    const days = Number(ctx.config.lookaheadDays ?? 14);
    const text = await loadIcs(source);
    const all = parseIcs(text);
    const events = withinDays(all, days);
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

export const icsModule: ConnectorModule = {
  template: icsTemplate,
  connector: icsConnector
};
