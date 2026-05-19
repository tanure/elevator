import { useState, type ReactElement } from "react";
import { PlugZap } from "lucide-react";
import type { ConnectorTemplate, Integration } from "@elevator/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { IntegrationFormDialog } from "./IntegrationFormDialog";
import { ConsentDialog } from "./ConsentDialog";

export interface AddIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ConnectorTemplate[];
  existing: Integration[];
  onAdded?: (instance: Integration) => void;
}

function requiresConsent(t: ConnectorTemplate): boolean {
  return (t.requiredPermissions?.length ?? 0) > 0 || (t.networkTargets?.length ?? 0) > 0;
}

/**
 * Three-step add flow: pick a template, accept the permissions/network
 * consent dialog (when applicable), then configure it. Single-instance
 * templates that already exist are hidden from the catalogue.
 */
export function AddIntegrationDialog({
  open,
  onOpenChange,
  templates,
  existing,
  onAdded
}: AddIntegrationDialogProps): ReactElement {
  const [picked, setPicked] = useState<ConnectorTemplate | null>(null);
  const [consented, setConsented] = useState(false);

  const available = templates.filter((t) => {
    if (t.supportsMultipleInstances) return true;
    return !existing.some((i) => i.templateId === t.id);
  });

  const showConsent = picked !== null && requiresConsent(picked) && !consented;
  const showForm = picked !== null && !showConsent;

  const reset = (): void => {
    setPicked(null);
    setConsented(false);
  };

  return (
    <>
      <Dialog
        open={open && picked === null}
        onOpenChange={(o) => {
          if (!o) onOpenChange(false);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add integration</DialogTitle>
            <DialogDescription>
              Choose a connector to add to this workspace.
            </DialogDescription>
          </DialogHeader>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All available integrations are already configured.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="flex flex-col items-start gap-1 rounded-md border border-border bg-card p-3 text-left transition hover:border-foreground/30 hover:bg-accent"
                  onClick={() => {
                    setPicked(t);
                    setConsented(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <PlugZap className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t.authStyle === "none" ? "No auth required" : t.authStyle}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConsentDialog
        open={open && showConsent}
        template={picked}
        onAccept={() => setConsented(true)}
        onCancel={() => {
          reset();
          onOpenChange(false);
        }}
      />

      <IntegrationFormDialog
        open={open && showForm}
        template={picked}
        instance={null}
        onOpenChange={(o) => {
          if (!o) {
            reset();
            onOpenChange(false);
          }
        }}
        onSaved={(inst) => {
          reset();
          onOpenChange(false);
          onAdded?.(inst);
        }}
      />
    </>
  );
}
