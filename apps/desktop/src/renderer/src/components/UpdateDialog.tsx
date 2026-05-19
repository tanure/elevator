import { useEffect, type ReactElement } from "react";
import { Download, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { useUpdatesStore } from "@renderer/stores/useUpdatesStore";

/**
 * Mounted once at the root. Subscribes to update state and pops a confirmation
 * dialog when an update has been silently downloaded in the background. The
 * dialog is dismissable per-version so we don't nag the user on every launch.
 */
export function UpdateDialog(): ReactElement | null {
  const { state, dismissedVersion, init, install, dismiss } = useUpdatesStore();

  useEffect(() => {
    void init();
  }, [init]);

  const isDownloaded = state.status === "downloaded" && state.availableVersion;
  const isDismissed =
    dismissedVersion !== null && dismissedVersion === state.availableVersion;
  const open = Boolean(isDownloaded) && !isDismissed;

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Update ready to install
          </DialogTitle>
          <DialogDescription>
            Elevator v{state.availableVersion} has been downloaded and is ready
            to install. Restart now to apply it.
          </DialogDescription>
        </DialogHeader>

        {state.releaseNotes && (
          <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-3 text-xs">
            <pre className="whitespace-pre-wrap font-sans text-muted-foreground">
              {state.releaseNotes}
            </pre>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={dismiss}>
            Later
          </Button>
          <Button onClick={() => void install()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart and install
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
