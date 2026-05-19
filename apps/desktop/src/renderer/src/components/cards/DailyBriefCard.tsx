import { useEffect, useMemo, type ReactElement } from "react";
import { Sparkles, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Button } from "@renderer/components/ui/button";
import { useAgentsStore } from "@renderer/stores/useAgentsStore";

export function DailyBriefCard(): ReactElement {
  const { history, lastRun, running, load, run } = useAgentsStore();

  useEffect(() => {
    void load();
  }, [load]);

  const latest = useMemo(() => {
    if (lastRun && lastRun.skillId === "daily-brief") return lastRun;
    return history.find((r) => r.skillId === "daily-brief");
  }, [history, lastRun]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Daily brief
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={running}
            onClick={() => void run("daily-brief")}
          >
            <Play className="mr-1 h-3 w-3" />
            {running ? "Running…" : "Refresh"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!latest ? (
          <p className="text-xs text-muted-foreground">
            No brief yet. Click Refresh to generate one.
          </p>
        ) : latest.status === "failed" ? (
          <p className="text-xs text-destructive">{latest.error}</p>
        ) : (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-foreground/80">
            {latest.output ?? ""}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
