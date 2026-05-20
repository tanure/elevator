import { useCallback, useEffect, useState, type ReactElement } from "react";
import { HeartPulse, RefreshCw, FolderOpen, FileDown, Database, Copy } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Separator } from "@renderer/components/ui/separator";
import { Badge } from "@renderer/components/ui/badge";
import type { DiagnosticsSnapshot } from "@elevator/shared";

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

interface Row {
  label: string;
  value: string;
}

function KvTable({ rows }: { rows: Row[] }): ReactElement {
  return (
    <div className="rounded-md border bg-card">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.label} className={idx === rows.length - 1 ? "" : "border-b"}>
              <td className="w-48 px-3 py-2 text-muted-foreground">{r.label}</td>
              <td className="px-3 py-2 font-mono text-xs break-all">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Diagnostics(): ReactElement {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const snap = await window.elevator.diagnostics.snapshot();
      setSnapshot(snap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCopy = useCallback(async (): Promise<void> => {
    if (!snapshot) return;
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setMessage("Diagnostics snapshot copied to clipboard.");
    setTimeout(() => setMessage(null), 3000);
  }, [snapshot]);

  const onOpenLogs = useCallback(async (): Promise<void> => {
    await window.elevator.diagnostics.openLogs();
  }, []);

  const onOpenDataFolder = useCallback(async (): Promise<void> => {
    await window.elevator.diagnostics.openDataFolder();
  }, []);

  const onExportDb = useCallback(async (): Promise<void> => {
    setBusy("db");
    try {
      const res = await window.elevator.backup.exportDatabase();
      if (res) {
        setMessage(`Database exported to ${res.filePath} (${formatBytes(res.bytes)}).`);
      }
    } catch (err) {
      setMessage(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(null);
      setTimeout(() => setMessage(null), 5000);
    }
  }, []);

  const onExportJson = useCallback(async (): Promise<void> => {
    setBusy("json");
    try {
      const res = await window.elevator.backup.exportJson();
      if (res) {
        setMessage(`JSON export written to ${res.filePath} (${formatBytes(res.bytes)}).`);
      }
    } catch (err) {
      setMessage(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(null);
      setTimeout(() => setMessage(null), 5000);
    }
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <HeartPulse className="h-6 w-6" /> Diagnostics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inspect runtime versions, file paths, and integration health. Use the
            export actions to share a backup or a bug report.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {message && (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm">
          {message}
        </div>
      )}

      {!snapshot ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Application</h2>
            <KvTable
              rows={[
                { label: "Name", value: snapshot.app.name },
                { label: "Version", value: snapshot.app.version },
                { label: "Packaged", value: snapshot.app.packaged ? "yes" : "no" },
                {
                  label: "Runtime",
                  value: `Electron ${snapshot.electron.electron} · Chromium ${snapshot.electron.chrome} · Node ${snapshot.electron.node}`
                },
                {
                  label: "OS",
                  value: `${snapshot.os.platform} ${snapshot.os.release} (${snapshot.os.arch})`
                },
                { label: "Captured at", value: formatDate(snapshot.capturedAt) }
              ]}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Paths</h2>
            <KvTable
              rows={[
                { label: "User data", value: snapshot.paths.userData },
                { label: "Database", value: snapshot.paths.dbPath },
                { label: "Logs", value: snapshot.paths.logsPath }
              ]}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => void onOpenLogs()}>
                <FolderOpen className="h-4 w-4" /> Open logs
              </Button>
              <Button variant="outline" size="sm" onClick={() => void onOpenDataFolder()}>
                <FolderOpen className="h-4 w-4" /> Open data folder
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Database</h2>
            <KvTable
              rows={[
                { label: "Size", value: formatBytes(snapshot.db.sizeBytes) },
                { label: "Last modified", value: formatDate(snapshot.db.lastModified) }
              ]}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Scheduler</h2>
            <KvTable
              rows={[
                { label: "Pending jobs", value: String(snapshot.scheduler.pendingJobs) },
                { label: "Running jobs", value: String(snapshot.scheduler.runningJobs) },
                { label: "Failed jobs", value: String(snapshot.scheduler.failedJobs) }
              ]}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Integrations</h2>
            {snapshot.integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No integrations configured.</p>
            ) : (
              <div className="rounded-md border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Template</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Last sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.integrations.map((i) => (
                      <tr key={i.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2">{i.name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{i.templateId || "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{i.status}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">{formatDate(i.lastSyncedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Backup & export</h2>
            <p className="text-sm text-muted-foreground">
              Database export is an exact SQLite copy. JSON export is human-readable
              and has secret fields redacted — safe to attach to bug reports.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void onExportDb()} disabled={busy !== null}>
                <Database className="h-4 w-4" />
                {busy === "db" ? "Exporting…" : "Export database (.db)"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onExportJson()}
                disabled={busy !== null}
              >
                <FileDown className="h-4 w-4" />
                {busy === "json" ? "Exporting…" : "Export data (.json)"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void onCopy()}>
                <Copy className="h-4 w-4" /> Copy diagnostics JSON
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
