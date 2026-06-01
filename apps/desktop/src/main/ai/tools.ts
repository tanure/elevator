import type { AgentTool, ToolCallResult } from "@elevator/shared";
import { listIntegrations } from "@elevator/data";
import { getDb } from "../db.js";
import { callConnectorTool, listAllTools } from "../integrations/registry.js";

/**
 * Flatten the connectors' tools across all connected instances into the
 * agent-facing `AgentTool` shape. Each tool gets a fully-qualified id
 * `${instanceName}.${toolId}` so skills can pin specific instances.
 *
 * Only connected instances are returned so skill authors don't see tools
 * that would fail at run time.
 */
export async function listAgentTools(): Promise<AgentTool[]> {
  const db = getDb();
  const instances = await listIntegrations(db);
  const byId = new Map(instances.map((i) => [i.id, i] as const));
  const tools = await listAllTools();
  const out: AgentTool[] = [];
  for (const t of tools) {
    const inst = byId.get(t.integrationId);
    if (!inst) continue;
    if (inst.status !== "connected") continue;
    const instanceName = inst.displayName || inst.name;
    out.push({
      id: `${instanceName}.${t.id}`,
      instanceId: inst.id,
      instanceName,
      toolId: t.id,
      title: t.name,
      description: t.description,
      kind: t.kind ?? "tool"
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Resolve an agent tool by its fully-qualified id (`instanceName.toolId`).
 * Falls back to a name lookup if the FQ id isn't found (handles renames
 * gracefully when an instance display name changes between authoring and run).
 */
export async function dispatchAgentTool(
  toolId: string,
  input: Record<string, unknown>
): Promise<ToolCallResult> {
  const tools = await listAgentTools();
  const match = tools.find((t) => t.id === toolId);
  if (!match) {
    return { ok: false, output: null, error: `Tool not available: ${toolId}` };
  }
  return callConnectorTool(match.instanceId, match.toolId, input);
}
