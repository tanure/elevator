import { useEffect, useState, type ReactElement } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import type { AuditLogEntry } from "@elevator/shared";

export function ActivityCard(): ReactElement {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    void window.elevator.audit.list({ limit: 6 }).then(setEntries);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-primary" />
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent activity</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 text-xs">
                <span className="font-medium text-foreground">{entry.action}</span>
                {entry.target && (
                  <span className="text-muted-foreground">{entry.target}</span>
                )}
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
