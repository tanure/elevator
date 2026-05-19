import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  PlugZap,
  Plus,
  RefreshCcw,
  Power,
  PowerOff,
  Wrench,
  Pencil,
  Trash2,
  RotateCw
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@renderer/components/ui/card";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { useIntegrationsStore } from "@renderer/stores/useIntegrationsStore";
import { AddIntegrationDialog } from "@renderer/components/integrations/AddIntegrationDialog";
import { IntegrationFormDialog } from "@renderer/components/integrations/IntegrationFormDialog";
import type { Integration, IntegrationStatus } from "@elevator/shared";

function statusVariant(
  status: IntegrationStatus
): "default" | "outline" | "destructive" | "secondary" {
  switch (status) {
    case "connected":
      return "default";
    case "error":
      return "destructive";
    case "pending":
      return "secondary";
    default:
      return "outline";
  }
}

export function Integrations(): ReactElement {
  const {
    integrations,
    templates,
    tools,
    health,
    loading,
    load,
    connect,
    disconnect,
    check,
    sync,
    remove
  } = useIntegrationsStore();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const toolsByIntegration = useMemo(() => {
    const map = new Map<string, typeof tools>();
    for (const tool of tools) {
      const list = map.get(tool.integrationId) ?? [];
      list.push(tool);
      map.set(tool.integrationId, list);
    }
    return map;
  }, [tools]);

  const templateById = useMemo(() => {
    const m = new Map<string, (typeof templates)[number]>();
    for (const t of templates) m.set(t.id, t);
    return m;
  }, [templates]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect services and extensions to power your dashboard and agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add integration
          </Button>
        </div>
      </div>

      {integrations.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <PlugZap className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">No integrations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a connector to bring tasks, calendars, and external tools into your dashboard.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add integration
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {integrations.map((integration) => {
            const integrationTools = toolsByIntegration.get(integration.id) ?? [];
            const lastHealth = health[integration.id];
            const template = integration.templateId
              ? templateById.get(integration.templateId)
              : undefined;
            return (
              <Card key={integration.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <PlugZap className="h-4 w-4 text-primary" />
                      {integration.displayName || integration.name}
                    </CardTitle>
                    <Badge
                      variant={statusVariant(integration.status)}
                      className="text-xs"
                    >
                      {integration.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {template?.name ?? integration.name}
                    {integration.lastCheckedAt
                      ? ` · checked ${new Date(integration.lastCheckedAt).toLocaleString()}`
                      : ""}
                    {integration.lastSyncAt
                      ? ` · synced ${new Date(integration.lastSyncAt).toLocaleString()}`
                      : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lastHealth ? (
                    <p
                      className={`text-xs ${
                        lastHealth.ok ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {lastHealth.message}
                    </p>
                  ) : integration.lastSyncError ? (
                    <p className="text-xs text-destructive">{integration.lastSyncError}</p>
                  ) : null}

                  {integrationTools.length > 0 ? (
                    <div>
                      <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Wrench className="h-3 w-3" /> Tools
                      </p>
                      <ul className="space-y-0.5 text-xs">
                        {integrationTools.map((t) => (
                          <li key={t.id} className="truncate" title={t.description}>
                            <code className="rounded bg-muted px-1 py-0.5">{t.id}</code>{" "}
                            <span className="text-muted-foreground">{t.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {integration.status === "connected" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void disconnect(integration.id)}
                      >
                        <PowerOff className="mr-2 h-3 w-3" /> Disconnect
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => void connect(integration.id)}>
                        <Power className="mr-2 h-3 w-3" /> Connect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void check(integration.id)}
                    >
                      <RefreshCcw className="mr-2 h-3 w-3" /> Check
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void sync(integration.id)}
                    >
                      <RotateCw className="mr-2 h-3 w-3" /> Sync
                    </Button>
                    {template ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(integration)}
                      >
                        <Pencil className="mr-2 h-3 w-3" /> Edit
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove "${integration.displayName || integration.name}"? Stored credentials will be deleted.`
                          )
                        ) {
                          void remove(integration.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddIntegrationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        templates={templates}
        existing={integrations}
      />

      <IntegrationFormDialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        template={
          editing && editing.templateId
            ? templateById.get(editing.templateId) ?? null
            : null
        }
        instance={editing}
      />
    </div>
  );
}
