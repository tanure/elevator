import type {
  ConnectorTemplate,
  ToolCallResult,
  ToolDescriptor
} from "@elevator/shared";
import type { Connector, ConnectorContext, ConnectorModule } from "../types.js";

/**
 * Work IQ connector — design stub.
 *
 * The plan calls out Work IQ as a first-class connection candidate. The real
 * connector will call into the Work IQ MCP server once credentials are wired
 * up. For now this stub keeps the template registered, advertises its
 * intended tool surface, and reports a `pending` health state so the UI can
 * show the design without exposing unfinished functionality.
 */

const TOOLS: ToolDescriptor[] = [
  {
    id: "workiq.summarise_meeting",
    integrationId: "workiq",
    name: "Summarise meeting (stub)",
    description:
      "Will summarise a Work IQ meeting transcript once the MCP bridge is configured.",
    requiredPermissions: ["integration:connect", "tool:execute"],
    inputSchema: {
      type: "object",
      properties: { meetingId: { type: "string" } },
      required: ["meetingId"]
    }
  }
];

export const workIqTemplate: ConnectorTemplate = {
  id: "workiq",
  name: "Work IQ",
  description:
    "Summarise meetings and pull action items from Work IQ via its MCP bridge (design stub).",
  type: "mcp",
  authStyle: "api-key",
  supportsMultipleInstances: false,
  icon: "Brain",
  configSchema: [
    {
      key: "endpoint",
      label: "MCP endpoint",
      type: "url",
      required: false,
      placeholder: "https://workiq.example.com/mcp",
      help: "Base URL of the Work IQ MCP server."
    },
    {
      key: "apiKey",
      label: "API key",
      type: "secret",
      required: false,
      help: "Will be stored in the OS credential vault."
    }
  ],
  requiredPermissions: ["integration:connect", "tool:execute"],
  networkTargets: ["workiq"]
};

export const workIqConnector: Connector = {
  id: "workiq",
  name: "Work IQ",
  type: "mcp",

  async check(_ctx: ConnectorContext) {
    return {
      ok: false,
      message: "Work IQ MCP bridge not configured (design stub)"
    };
  },

  listTools() {
    return TOOLS;
  },

  async callTool(): Promise<ToolCallResult> {
    return {
      ok: false,
      output: null,
      error: "Work IQ connector is a design stub and cannot execute tools yet."
    };
  }
};

export const workIqModule: ConnectorModule = {
  template: workIqTemplate,
  connector: workIqConnector
};
