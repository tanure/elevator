import type { ReactElement } from "react";
import { ShieldAlert } from "lucide-react";
import type { ConnectorTemplate } from "@elevator/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";

export interface ConsentDialogProps {
  open: boolean;
  template: ConnectorTemplate | null;
  onAccept: () => void;
  onCancel: () => void;
}

/**
 * Shown before configuring any integration that requires permissions or
 * outbound network access. The user must explicitly accept before secrets or
 * URLs are entered. This satisfies the "consent dialog before privileged
 * integrations" requirement from Phase 6B.13.
 */
export function ConsentDialog({
  open,
  template,
  onAccept,
  onCancel
}: ConsentDialogProps): ReactElement | null {
  if (!template) return null;
  const permissions = template.requiredPermissions ?? [];
  const targets = template.networkTargets ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Review what {template.name} can do
          </DialogTitle>
          <DialogDescription>
            Elevator never sends data anywhere without your consent. Please confirm
            the access this integration needs before continuing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {permissions.length > 0 && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Permissions
              </h3>
              <ul className="space-y-1 text-sm">
                {permissions.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
                    <code className="text-xs">{p}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {targets.length > 0 && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Network endpoints
              </h3>
              <ul className="space-y-1 text-sm">
                {targets.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
                    <span className="text-xs text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {permissions.length === 0 && targets.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This integration declares no special permissions or network targets.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onAccept}>I understand, continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
