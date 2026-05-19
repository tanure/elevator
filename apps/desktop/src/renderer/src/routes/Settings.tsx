import { useEffect, type ReactElement } from "react";
import { RefreshCw } from "lucide-react";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Separator } from "@renderer/components/ui/separator";
import { Button } from "@renderer/components/ui/button";
import { Badge } from "@renderer/components/ui/badge";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useAppStore } from "@renderer/stores/useAppStore";
import { useUpdatesStore } from "@renderer/stores/useUpdatesStore";

function formatLastChecked(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "never";
  return d.toLocaleString();
}

function updateStatusLabel(status: string): string {
  switch (status) {
    case "checking":
      return "Checking…";
    case "available":
      return "Update available";
    case "downloading":
      return "Downloading…";
    case "downloaded":
      return "Ready to install";
    case "not-available":
      return "Up to date";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

export function Settings(): ReactElement {
  const { settings, load, setSetting } = useSettingsStore();
  const { appInfo } = useAppStore();
  const { state: updateState, init: initUpdates, check, install } = useUpdatesStore();

  useEffect(() => {
    void load();
    void initUpdates();
  }, [load, initUpdates]);

  const isChecking = updateState.status === "checking";
  const isDownloading = updateState.status === "downloading";
  const canInstall = updateState.status === "downloaded";

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="max-w-md space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Application</h2>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="text-sm text-muted-foreground">Version</span>
            <span className="text-sm">v{appInfo.version}</span>
          </div>
          <div className="rounded-md border px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Updates</span>
              <Badge variant="secondary">{updateStatusLabel(updateState.status)}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Last checked</span>
              <span>{formatLastChecked(updateState.lastCheckedAt)}</span>
            </div>
            {isDownloading && updateState.progress && (
              <div className="text-xs text-muted-foreground">
                {Math.round(updateState.progress.percent)}% downloaded
              </div>
            )}
            {updateState.status === "available" && updateState.availableVersion && (
              <div className="text-xs text-muted-foreground">
                v{updateState.availableVersion} found
              </div>
            )}
            {updateState.error && (
              <div className="text-xs text-destructive">{updateState.error}</div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void check()}
                disabled={isChecking || isDownloading}
              >
                <RefreshCw
                  className={`mr-2 h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`}
                />
                Check for updates
              </Button>
              {canInstall && (
                <Button size="sm" onClick={() => void install()}>
                  Restart and install
                </Button>
              )}
            </div>
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Preferences</h2>
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              placeholder="Your name"
              defaultValue={settings["user.displayName"] ?? ""}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== (settings["user.displayName"] ?? "")) {
                  void setSetting("user.displayName", next);
                }
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
