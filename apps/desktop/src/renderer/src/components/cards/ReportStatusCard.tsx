import { useCallback, useEffect, useState, type ReactElement } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import type { Integration, ReportSnapshot } from "@elevator/shared";

interface AggregatedReport extends ReportSnapshot {
  source: string;
}

export function ReportStatusCard(): ReactElement {
  const [reports, setReports] = useState<AggregatedReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const integrations: Integration[] = await window.elevator.integrations.list();
    const collected: AggregatedReport[] = [];
    for (const integration of integrations) {
      const data = await window.elevator.integrations.getSyncData(integration.id);
      if (data?.kind === "report" && data.report) {
        collected.push({ ...data.report, source: integration.displayName });
      }
    }
    setReports(collected.slice(0, 3));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-primary" />
          Reports
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add a Generic HTTP report integration and click Sync to surface snapshots here.
          </p>
        ) : (
          <ul className="space-y-3">
            {reports.map((report, idx) => (
              <li key={`${report.source}|${idx}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-foreground" title={report.title}>
                    {report.title}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(report.fetchedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
                {report.headline && (
                  <p className="text-sm font-semibold text-foreground">{report.headline}</p>
                )}
                {report.rows && report.rows.length > 0 && (
                  <ul className="space-y-0.5">
                    {report.rows.slice(0, 4).map((row, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-xs text-muted-foreground"
                      >
                        <span className="truncate" title={row.label}>
                          {row.label}
                        </span>
                        <span className="shrink-0 font-medium text-foreground">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
