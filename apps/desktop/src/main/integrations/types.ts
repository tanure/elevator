import type {
  ConnectorTemplate,
  IntegrationSyncData,
  ToolCallResult,
  ToolDescriptor
} from "@elevator/shared";

/**
 * Runtime context handed to a connector for each tool/check invocation.
 * `config` carries the resolved per-instance values (with secrets already
 * decrypted by the registry); `instanceId` lets connectors scope side
 * effects (e.g. cache files, OAuth tokens) per-instance.
 */
export interface ConnectorContext {
  instanceId: string;
  config: Record<string, unknown>;
}

export interface Connector {
  /** Stable identifier — equals the template id. */
  readonly id: string;
  /** Human-readable template name. */
  readonly name: string;
  readonly type: "api" | "mcp" | "cli";

  /** Lightweight health probe; resolves with a human-readable message. */
  check(ctx: ConnectorContext): Promise<{ ok: boolean; message: string }>;

  /** Tools the connector exposes to the agent runtime. */
  listTools(ctx: ConnectorContext): ToolDescriptor[];

  /** Execute a tool by id; implementations must validate input themselves. */
  callTool(
    ctx: ConnectorContext,
    toolId: string,
    input: Record<string, unknown>
  ): Promise<ToolCallResult>;

  /**
   * Optional sync hook. Connectors that contribute data to dashboard cards
   * (calendar, mail, reports) implement this to pull fresh data; the
   * registry persists the returned payload to a per-instance cache file.
   */
  sync?(ctx: ConnectorContext): Promise<IntegrationSyncData>;

  /**
   * Optional OAuth-style connect flow. When present the registry calls this
   * instead of (or in addition to) `check()` during `connect`. The connector
   * is responsible for persisting tokens via the shared cache/secret helpers.
   */
  connect?(ctx: ConnectorContext): Promise<{ ok: boolean; message: string }>;
}

/**
 * A connector module exports a `ConnectorTemplate` (UI/catalogue metadata
 * including the config schema) plus the runtime `Connector` implementation
 * that drives instances built from that template.
 */
export interface ConnectorModule {
  template: ConnectorTemplate;
  connector: Connector;
}
