import { useEffect, useState, type ReactElement } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import type { AgentRun, ExtensionRecord } from "@elevator/shared";

interface Props {
  extension: ExtensionRecord;
}

export function ExtensionCard({ extension }: Props): ReactElement {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (!extension.agentId) {
        if (!cancelled) {
          setRun(null);
          setLoading(false);
        }
        return;
      }
      try {
        const latest = await window.elevator.extensions.latestRun(extension.agentId);
        if (!cancelled) setRun(latest);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [extension.agentId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          {extension.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {extension.description && (
          <p className="mb-2 text-[11px] text-muted-foreground">{extension.description}</p>
        )}
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !run ? (
          <p className="text-xs text-muted-foreground">No runs yet.</p>
        ) : run.status === "failed" ? (
          <p className="text-xs text-destructive">{run.error ?? "Run failed"}</p>
        ) : (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-foreground/80">
            {run.output ?? ""}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
