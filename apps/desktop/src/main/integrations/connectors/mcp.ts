import type {
  ConnectorTemplate,
  ToolCallResult,
  ToolDescriptor
} from "@elevator/shared";
import type { Connector, ConnectorContext, ConnectorModule } from "../types.js";
import { eventBus } from "../../event-bus.js";

/**
 * Generic Model Context Protocol (MCP) connector.
 *
 * Lets the user point at any MCP server that speaks stdio — e.g.
 * `npx -y @microsoft/work-iq`, `uvx mcp-server-fetch`, or any custom binary.
 * Tools the server advertises are surfaced to the agent runtime under
 * `mcp:<instanceId>:<tool-name>` identifiers.
 */

interface McpConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
}

interface Entry {
  fingerprint: string;
  client: unknown;
  transport: unknown;
  tools: ToolDescriptor[];
  closing?: Promise<void>;
}

const entries = new Map<string, Entry>();
let lifecycleSubscribed = false;

function ensureLifecycle(): void {
  if (lifecycleSubscribed) return;
  lifecycleSubscribed = true;
  eventBus.on("integration.deleted", ({ id }) => {
    void closeEntry(id);
  });
}

function parseArgs(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((a) => String(a));
  const s = String(raw ?? "").trim();
  if (!s) return [];
  // Split on whitespace but honor "double quoted" segments.
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push(m[1] ?? m[2] ?? "");
  }
  return out;
}

function parseEnv(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const s = String(raw ?? "").trim();
  if (!s) return out;
  for (const line of s.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function readCfg(ctx: ConnectorContext): McpConfig {
  return {
    command: String(ctx.config.command ?? "").trim(),
    args: parseArgs(ctx.config.args),
    env: parseEnv(ctx.config.env),
    cwd: ctx.config.cwd ? String(ctx.config.cwd) : undefined
  };
}

function fingerprintFor(cfg: McpConfig): string {
  return JSON.stringify({
    command: cfg.command,
    args: cfg.args,
    env: cfg.env,
    cwd: cfg.cwd ?? ""
  });
}

async function closeEntry(instanceId: string): Promise<void> {
  const entry = entries.get(instanceId);
  if (!entry) return;
  entries.delete(instanceId);
  try {
    const c = entry.client as { close?: () => Promise<void> } | null;
    await c?.close?.();
  } catch {
    /* swallow */
  }
}

function mcpToolId(instanceId: string, toolName: string): string {
  return `mcp:${instanceId}:${toolName}`;
}

function extractToolName(toolId: string): string | null {
  const parts = toolId.split(":");
  if (parts.length < 3 || parts[0] !== "mcp") return null;
  return parts.slice(2).join(":");
}

async function dynamicImport<T>(spec: string): Promise<T> {
  // Indirect import keeps electron-vite from trying to pre-bundle the SDK,
  // which would force its CJS internals into the ESM main bundle.
  return (await import(/* @vite-ignore */ spec)) as T;
}

interface SdkModules {
  Client: new (info: { name: string; version: string }) => {
    connect: (transport: unknown) => Promise<void>;
    close: () => Promise<void>;
    listTools: () => Promise<{
      tools: Array<{
        name: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
      }>;
    }>;
    callTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<{
      content?: Array<Record<string, unknown>>;
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    }>;
  };
  StdioClientTransport: new (params: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    stderr?: "pipe" | "ignore" | "inherit";
  }) => { stderr: NodeJS.ReadableStream | null };
}

async function loadSdk(): Promise<SdkModules> {
  const clientMod = await dynamicImport<{ Client: SdkModules["Client"] }>(
    "@modelcontextprotocol/sdk/client/index.js"
  );
  const stdioMod = await dynamicImport<{
    StdioClientTransport: SdkModules["StdioClientTransport"];
  }>("@modelcontextprotocol/sdk/client/stdio.js");
  return {
    Client: clientMod.Client,
    StdioClientTransport: stdioMod.StdioClientTransport
  };
}

async function ensureConnected(ctx: ConnectorContext): Promise<Entry> {
  ensureLifecycle();
  const cfg = readCfg(ctx);
  if (!cfg.command) {
    throw new Error("MCP server command is required.");
  }
  const fp = fingerprintFor(cfg);
  const existing = entries.get(ctx.instanceId);
  if (existing && existing.fingerprint === fp) return existing;
  if (existing) await closeEntry(ctx.instanceId);

  const { Client, StdioClientTransport } = await loadSdk();
  const transport = new StdioClientTransport({
    command: cfg.command,
    args: cfg.args,
    env: { ...process.env as Record<string, string>, ...cfg.env },
    cwd: cfg.cwd,
    stderr: "pipe"
  });

  // Capture stderr so we can surface useful diagnostics if the child exits
  // before / during the MCP handshake. Kept to a small ring buffer.
  let stderrTail = "";
  const stderrStream = transport.stderr;
  if (stderrStream) {
    stderrStream.on("data", (chunk: Buffer | string) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-4000);
    });
  }

  const client = new Client({ name: "elevator-desktop", version: "0.1.0" });
  const decorateError = (err: unknown): Error => {
    const base = err instanceof Error ? err.message : String(err);
    const tail = stderrTail.trim();
    const hint =
      tail.length > 0
        ? `\n\nServer stderr:\n${tail}`
        : "\n\n(Server produced no stderr output. The command may have been not found, exited immediately, or is not an MCP server.)";
    return new Error(`${base}${hint}`);
  };

  try {
    await client.connect(transport);
  } catch (err) {
    throw decorateError(err);
  }

  let listed: Awaited<ReturnType<typeof client.listTools>>;
  try {
    listed = await client.listTools();
  } catch (err) {
    await client.close().catch(() => undefined);
    throw decorateError(err);
  }
  const tools: ToolDescriptor[] = (listed.tools ?? []).map((t) => ({
    id: mcpToolId(ctx.instanceId, t.name),
    integrationId: ctx.instanceId,
    name: t.name,
    description: t.description ?? `MCP tool ${t.name}`,
    requiredPermissions: ["tool:execute"],
    inputSchema:
      t.inputSchema && typeof t.inputSchema === "object"
        ? (t.inputSchema as Record<string, unknown>)
        : { type: "object", properties: {} }
  }));
  const entry: Entry = { fingerprint: fp, client, transport, tools };
  entries.set(ctx.instanceId, entry);
  return entry;
}

function summarizeContent(content: Array<Record<string, unknown>> | undefined): unknown {
  if (!content || content.length === 0) return null;
  // If every block is plain text, concatenate. Otherwise return the raw blocks.
  const allText = content.every((b) => b.type === "text" && typeof b.text === "string");
  if (allText) return content.map((b) => String(b.text)).join("\n");
  return content;
}

export const mcpTemplate: ConnectorTemplate = {
  id: "mcp-server",
  name: "MCP Server",
  description:
    "Connect to any Model Context Protocol server over stdio (e.g. `npx -y @microsoft/work-iq`). Tools the server advertises are exposed to the agent.",
  type: "mcp",
  authStyle: "none",
  supportsMultipleInstances: true,
  icon: "Plug",
  configSchema: [
    {
      key: "command",
      label: "Command",
      type: "string",
      required: true,
      placeholder: "npx",
      help: "Executable that launches the MCP server (e.g. `npx`, `uvx`, `node`, or an absolute path)."
    },
    {
      key: "args",
      label: "Arguments",
      type: "string",
      required: false,
      placeholder: "-y @microsoft/work-iq",
      help: "Space-separated arguments. Use double quotes to group values that contain spaces."
    },
    {
      key: "env",
      label: "Environment variables",
      type: "multiline",
      required: false,
      placeholder: "KEY=value\nOTHER=value",
      help: "One KEY=value per line. Merged onto the desktop process environment."
    },
    {
      key: "cwd",
      label: "Working directory",
      type: "path",
      required: false,
      help: "Optional working directory for the spawned MCP server."
    }
  ],
  requiredPermissions: ["integration:connect", "tool:execute"],
  networkTargets: ["mcp-server (local process)"]
};

export const mcpConnector: Connector = {
  id: "mcp-server",
  name: "MCP Server",
  type: "mcp",

  async check(ctx) {
    try {
      const entry = await ensureConnected(ctx);
      return {
        ok: true,
        message: `Connected. ${entry.tools.length} tool${entry.tools.length === 1 ? "" : "s"} available.`
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async connect(ctx) {
    try {
      const entry = await ensureConnected(ctx);
      return {
        ok: true,
        message: `Connected. ${entry.tools.length} tool${entry.tools.length === 1 ? "" : "s"} available.`
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  listTools(ctx) {
    const entry = entries.get(ctx.instanceId);
    if (entry) return entry.tools;
    // Cold start: trigger a connect attempt in the background so the next
    // `listTools` call returns the discovered tools. We can't await here
    // because `listTools` is synchronous.
    void ensureConnected(ctx).catch(() => undefined);
    return [];
  },

  async callTool(ctx, toolId, input): Promise<ToolCallResult> {
    const name = extractToolName(toolId);
    if (!name) {
      return { ok: false, output: null, error: `Not an MCP tool id: ${toolId}` };
    }
    try {
      const entry = await ensureConnected(ctx);
      const c = entry.client as InstanceType<SdkModules["Client"]>;
      const args =
        input && typeof input === "object" ? (input as Record<string, unknown>) : {};
      const res = await c.callTool({ name, arguments: args });
      if (res.isError) {
        const errText = summarizeContent(res.content);
        return {
          ok: false,
          output: errText ?? null,
          error: typeof errText === "string" ? errText : "MCP tool reported isError=true"
        };
      }
      return {
        ok: true,
        output: res.structuredContent ?? summarizeContent(res.content)
      };
    } catch (err) {
      return {
        ok: false,
        output: null,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
};

export const mcpModule: ConnectorModule = {
  template: mcpTemplate,
  connector: mcpConnector
};
