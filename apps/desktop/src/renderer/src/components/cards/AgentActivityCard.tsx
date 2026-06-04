import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import type { Integration } from "@elevator/shared";

interface AgentThreadSummary {
  id: string;
  topic: string;
  lastActivity: string;
}

interface AgentActivityPayload {
  type: "m365-agent.activity.v1";
  agentId: string;
  threads: AgentThreadSummary[];
}

function isAgentPayload(raw: unknown): raw is AgentActivityPayload {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as Record<string, unknown>).type === "m365-agent.activity.v1"
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function AgentActivityCard(): ReactElement {
  const [threads, setThreads] = useState<AgentThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const integrations: Integration[] = await window.elevator.integrations.list();
    const collected: AgentThreadSummary[] = [];
    for (const integration of integrations) {
      if (integration.templateId !== "m365-agent") continue;
      const data = await window.elevator.integrations.getSyncData(integration.id);
      if (data?.kind === "custom" && isAgentPayload(data.raw)) {
        collected.push(...data.raw.threads);
      }
    }
    collected.sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
    setThreads(collected.slice(0, 6));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bot className="h-4 w-4 text-primary" />
          Agent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Connect a Microsoft Agent 365 integration and click Sync to see recent activity.
          </p>
        ) : (
          <ul className="space-y-2">
            {threads.map((thread) => (
              <li key={thread.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-foreground" title={thread.topic}>
                    {thread.topic}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatTime(thread.lastActivity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
