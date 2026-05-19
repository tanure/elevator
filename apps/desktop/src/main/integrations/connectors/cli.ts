import { spawn } from "node:child_process";
import type {
  ConnectorTemplate,
  ToolCallResult,
  ToolDescriptor
} from "@elevator/shared";
import type { Connector, ConnectorContext, ConnectorModule } from "../types.js";

/**
 * Allow-list of CLI commands the connector may run. Prevents arbitrary
 * shell injection: only these binaries can be invoked via the `run` tool.
 */
const ALLOWED_COMMANDS = new Set(["node", "git", "where", "echo"]);

function runCommand(
  command: string,
  args: string[],
  timeoutMs = 5_000
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

const TOOLS: ToolDescriptor[] = [
  {
    id: "cli.run",
    integrationId: "cli",
    name: "Run CLI command",
    description: `Run an allow-listed CLI command. Allowed: ${[...ALLOWED_COMMANDS].join(", ")}.`,
    requiredPermissions: ["tool:execute"],
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", enum: [...ALLOWED_COMMANDS] },
        args: { type: "array", items: { type: "string" } }
      },
      required: ["command"]
    }
  },
  {
    id: "cli.which",
    integrationId: "cli",
    name: "Locate a binary",
    description: "Resolve the path to a binary on PATH (via `where`).",
    requiredPermissions: ["tool:execute"],
    inputSchema: {
      type: "object",
      properties: { binary: { type: "string" } },
      required: ["binary"]
    }
  }
];

export const cliTemplate: ConnectorTemplate = {
  id: "cli",
  name: "Local CLI",
  description:
    "Run allow-listed local CLI commands (node, git, where, echo) from the agent runtime.",
  type: "cli",
  authStyle: "none",
  supportsMultipleInstances: false,
  icon: "Terminal",
  configSchema: [
    {
      key: "timeoutMs",
      label: "Command timeout (ms)",
      type: "number",
      required: false,
      defaultValue: 5000,
      min: 500,
      max: 60_000,
      help: "Maximum runtime for a single CLI invocation."
    }
  ],
  requiredPermissions: ["tool:execute"]
};

export const cliConnector: Connector = {
  id: "cli",
  name: "Local CLI",
  type: "cli",

  async check(_ctx: ConnectorContext) {
    const result = await runCommand("node", ["--version"]);
    if (result.code === 0) {
      return { ok: true, message: `node ${result.stdout.trim()} available` };
    }
    return { ok: false, message: result.stderr.trim() || "node not found" };
  },

  listTools() {
    return TOOLS;
  },

  async callTool(ctx, toolId, input): Promise<ToolCallResult> {
    const timeoutMs = Number(ctx.config.timeoutMs ?? 5_000);
    if (toolId === "cli.run") {
      const command = String(input.command ?? "");
      const args = Array.isArray(input.args) ? input.args.map(String) : [];
      if (!ALLOWED_COMMANDS.has(command)) {
        return { ok: false, output: null, error: `Command not allow-listed: ${command}` };
      }
      const r = await runCommand(command, args, timeoutMs);
      return {
        ok: r.code === 0,
        output: { code: r.code, stdout: r.stdout, stderr: r.stderr },
        error: r.code === 0 ? undefined : r.stderr.trim() || `Exit code ${r.code}`
      };
    }
    if (toolId === "cli.which") {
      const binary = String(input.binary ?? "");
      if (!binary) return { ok: false, output: null, error: "binary is required" };
      const r = await runCommand("where", [binary], timeoutMs);
      return {
        ok: r.code === 0,
        output: r.stdout.trim(),
        error: r.code === 0 ? undefined : r.stderr.trim() || "not found"
      };
    }
    return { ok: false, output: null, error: `Unknown tool: ${toolId}` };
  }
};

export const cliModule: ConnectorModule = {
  template: cliTemplate,
  connector: cliConnector
};
