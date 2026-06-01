import type { ConnectorTemplate, ToolCallResult, ToolDescriptor } from "@elevator/shared";
import type { Connector, ConnectorContext, ConnectorModule } from "../types.js";

/**
 * Microsoft Agent 365 connector — **preview scaffold for M9**.
 *
 * This module is intentionally inert: it ships the catalogue template and a
 * `Connector` whose lifecycle methods return "not implemented". It is only
 * registered when `ELEVATOR_ENABLE_M365_AGENT=1` (see `registry.ts`), so it
 * never appears in the production template catalogue.
 *
 * The full implementation is tracked under Milestone 9 — see
 * `docs/adr/ADR-0005-microsoft-agent-365.md` for the design intent.
 */

const NOT_IMPLEMENTED =
  "Microsoft Agent 365 is a preview scaffold (M9). Implementation pending — see ADR-0005.";

export const m365AgentTemplate: ConnectorTemplate = {
  id: "m365-agent",
  name: "Microsoft Agent 365 (preview)",
  description:
    "Invoke and observe Microsoft 365 Agents from Elevator. Preview scaffold — not yet implemented.",
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
      placeholder: "00000000-0000-0000-0000-000000000000"
    },
    {
      key: "agentId",
      label: "Agent id",
      type: "string",
      required: false,
      placeholder: "Optional — defaults to the tenant's primary agent"
    },
    {
      key: "endpoint",
      label: "Agents endpoint override",
      type: "string",
      required: false,
      placeholder: "Optional — leave blank to use the default Agents endpoint"
    }
  ],
  requiredPermissions: ["integration:connect"],
  networkTargets: ["login.microsoftonline.com", "graph.microsoft.com"]
};

const TOOLS: ToolDescriptor[] = [];

export const m365AgentConnector: Connector = {
  id: "m365-agent",
  name: "Microsoft Agent 365 (preview)",
  type: "api",

  async check(_ctx: ConnectorContext) {
    return { ok: false, message: NOT_IMPLEMENTED };
  },

  async connect(_ctx: ConnectorContext) {
    return { ok: false, message: NOT_IMPLEMENTED };
  },

  listTools(): ToolDescriptor[] {
    return TOOLS;
  },

  async callTool(): Promise<ToolCallResult> {
    return { ok: false, output: null, error: NOT_IMPLEMENTED };
  }
};

export const m365AgentModule: ConnectorModule = {
  template: m365AgentTemplate,
  connector: m365AgentConnector
};
