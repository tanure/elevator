import type {
  ConnectorTemplate,
  IntegrationSyncData,
  ReportSnapshot,
  ToolCallResult,
  ToolDescriptor
} from "@elevator/shared";
import type { Connector, ConnectorContext, ConnectorModule } from "../types.js";
import { setSyncCache } from "../cache.js";

const TOOLS: ToolDescriptor[] = [
  {
    id: "http.fetch",
    integrationId: "http-report",
    name: "Fetch report",
    description: "GET the configured endpoint and return the parsed JSON response.",
    requiredPermissions: ["tool:execute"],
    inputSchema: { type: "object", properties: {} }
  }
];

interface Cfg {
  endpoint: string;
  title?: string;
  headlinePath?: string;
  rowsPath?: string;
  authHeaderName?: string;
  bearerToken?: string;
}

function readCfg(ctx: ConnectorContext): Cfg {
  return {
    endpoint: String(ctx.config.endpoint ?? ""),
    title: ctx.config.title ? String(ctx.config.title) : undefined,
    headlinePath: ctx.config.headlinePath ? String(ctx.config.headlinePath) : undefined,
    rowsPath: ctx.config.rowsPath ? String(ctx.config.rowsPath) : undefined,
    authHeaderName: ctx.config.authHeaderName ? String(ctx.config.authHeaderName) : undefined,
    bearerToken: typeof ctx.config.bearerToken === "string" ? ctx.config.bearerToken : undefined
  };
}

function readPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  let current: unknown = obj;
  for (const part of path.split(".")) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

async function doFetch(cfg: Cfg): Promise<{ ok: boolean; data?: unknown; status: number; message: string }> {
  if (!cfg.endpoint) return { ok: false, status: 0, message: "Endpoint is required." };
  if (!/^https?:\/\//i.test(cfg.endpoint)) {
    return { ok: false, status: 0, message: "Endpoint must be an http(s) URL." };
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cfg.bearerToken) {
    headers[cfg.authHeaderName?.trim() || "Authorization"] = cfg.authHeaderName?.trim()
      ? cfg.bearerToken
      : `Bearer ${cfg.bearerToken}`;
  }
  try {
    const res = await fetch(cfg.endpoint, { headers });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    try {
      return { ok: true, status: res.status, data: JSON.parse(text), message: "ok" };
    } catch {
      return { ok: true, status: res.status, data: text, message: "ok (non-JSON)" };
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : String(err)
    };
  }
}

function buildSnapshot(cfg: Cfg, data: unknown): ReportSnapshot {
  const headline =
    cfg.headlinePath != null ? String(readPath(data, cfg.headlinePath) ?? "") : undefined;
  let rows: ReportSnapshot["rows"] | undefined;
  if (cfg.rowsPath) {
    const raw = readPath(data, cfg.rowsPath);
    if (Array.isArray(raw)) {
      rows = raw.slice(0, 20).map((r) => {
        if (r && typeof r === "object") {
          const obj = r as Record<string, unknown>;
          const label = String(obj.label ?? obj.name ?? obj.title ?? "(row)");
          const value = String(obj.value ?? obj.count ?? obj.amount ?? "");
          return { label, value };
        }
        return { label: String(r), value: "" };
      });
    }
  }
  return {
    title: cfg.title ?? "Report",
    headline: headline && headline.length > 0 ? headline : undefined,
    rows,
    url: cfg.endpoint,
    fetchedAt: new Date().toISOString()
  };
}

export const httpReportTemplate: ConnectorTemplate = {
  id: "http-report",
  name: "Generic HTTP report",
  description:
    "Fetch a JSON report from any HTTP endpoint. Optional bearer token; configurable headline and rows JSON paths.",
  type: "api",
  authStyle: "api-key",
  supportsMultipleInstances: true,
  icon: "BarChart3",
  configSchema: [
    {
      key: "title",
      label: "Report title",
      type: "string",
      required: false,
      placeholder: "Open issues by team"
    },
    {
      key: "endpoint",
      label: "Endpoint URL",
      type: "url",
      required: true,
      placeholder: "https://reports.example.com/api/today.json"
    },
    {
      key: "headlinePath",
      label: "Headline JSON path",
      type: "string",
      required: false,
      placeholder: "summary.headline",
      help: "Dot path to a single string/number value used as the card headline."
    },
    {
      key: "rowsPath",
      label: "Rows JSON path",
      type: "string",
      required: false,
      placeholder: "rows",
      help: "Dot path to an array of `{label,value}` objects rendered as a table."
    },
    {
      key: "authHeaderName",
      label: "Auth header name",
      type: "string",
      required: false,
      placeholder: "Authorization",
      help: "Leave blank to use Authorization: Bearer <token>."
    },
    {
      key: "bearerToken",
      label: "Bearer token / API key",
      type: "secret",
      required: false,
      help: "Stored in the OS credential vault."
    }
  ],
  requiredPermissions: ["integration:connect"],
  networkTargets: ["the report endpoint host you configure"]
};

export const httpReportConnector: Connector = {
  id: "http-report",
  name: "Generic HTTP report",
  type: "api",

  async check(ctx) {
    const cfg = readCfg(ctx);
    const res = await doFetch(cfg);
    return res.ok
      ? { ok: true, message: `HTTP ${res.status} OK` }
      : { ok: false, message: res.message };
  },

  listTools() {
    return TOOLS;
  },

  async callTool(ctx, toolId): Promise<ToolCallResult> {
    if (toolId !== "http.fetch") {
      return { ok: false, output: null, error: `Unknown tool: ${toolId}` };
    }
    const cfg = readCfg(ctx);
    const res = await doFetch(cfg);
    if (!res.ok) return { ok: false, output: null, error: res.message };
    return { ok: true, output: res.data };
  },

  async sync(ctx): Promise<IntegrationSyncData> {
    const cfg = readCfg(ctx);
    const res = await doFetch(cfg);
    if (!res.ok) throw new Error(res.message);
    const report = buildSnapshot(cfg, res.data);
    const data: IntegrationSyncData = {
      integrationId: ctx.instanceId,
      kind: "report",
      fetchedAt: report.fetchedAt,
      report,
      raw: res.data
    };
    await setSyncCache(ctx.instanceId, data);
    return data;
  }
};

export const httpReportModule: ConnectorModule = {
  template: httpReportTemplate,
  connector: httpReportConnector
};
