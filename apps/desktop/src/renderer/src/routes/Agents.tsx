import { useEffect, type ReactElement } from "react";
import { Bot, Play, RefreshCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@renderer/components/ui/card";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { useAgentsStore } from "@renderer/stores/useAgentsStore";
import type { AgentRunStatus } from "@elevator/shared";

function statusVariant(
  status: AgentRunStatus
): "default" | "destructive" | "secondary" {
  switch (status) {
    case "succeeded":
      return "default";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}

export function Agents(): ReactElement {
  const {
    skills,
    history,
    providers,
    activeProvider,
    running,
    load,
    run,
    setProvider
  } = useAgentsStore();

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Run built-in skills and review the audit trail of every agent invocation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {providers.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === activeProvider ? "default" : "outline"}
              onClick={() => void setProvider(p)}
            >
              {p}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Skills</h2>
          {skills.map((skill) => (
            <Card key={skill.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Bot className="h-4 w-4 text-primary" />
                  {skill.title}
                </CardTitle>
                <CardDescription className="text-xs">{skill.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {skill.requiredPermissions.map((perm) => (
                    <Badge key={perm} variant="outline" className="text-[10px]">
                      {perm}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  disabled={running}
                  onClick={() => void run(skill.id)}
                >
                  <Play className="mr-2 h-3 w-3" />
                  Run
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent runs</h2>
          <ScrollArea className="h-[480px] rounded-md border">
            <div className="space-y-2 p-3">
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No runs yet.</p>
              ) : (
                history.map((run) => (
                  <Card key={run.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-mono">
                          {run.skillId}
                        </CardTitle>
                        <Badge
                          variant={statusVariant(run.status)}
                          className="text-[10px]"
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <CardDescription className="text-[10px]">
                        {new Date(run.startedAt).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {run.error ?? run.output ?? ""}
                      </pre>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
