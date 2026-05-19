import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Loader2 } from "lucide-react";
import type {
  ConfigValidationError,
  ConnectorTemplate,
  Integration,
  IntegrationHealth
} from "@elevator/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { useIntegrationsStore } from "@renderer/stores/useIntegrationsStore";
import { ConnectorForm } from "./ConnectorForm";

export interface IntegrationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Template to instantiate; required when creating. */
  template: ConnectorTemplate | null;
  /** Existing instance when editing; null when creating. */
  instance?: Integration | null;
  onSaved?: (instance: Integration) => void;
}

function errorsToMap(errs?: ConfigValidationError[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of errs ?? []) out[e.field] = e.message;
  return out;
}

/**
 * Unified create/edit dialog driven by a `ConnectorTemplate`. Falls back to a
 * disabled state when no template is supplied so the parent can render the
 * dialog ahead of time.
 */
export function IntegrationFormDialog({
  open,
  onOpenChange,
  template,
  instance,
  onSaved
}: IntegrationFormDialogProps): ReactElement {
  const { create, update, test } = useIntegrationsStore();
  const editing = Boolean(instance);

  const [displayName, setDisplayName] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<IntegrationHealth | null>(null);
  const [busy, setBusy] = useState<"idle" | "saving" | "testing">("idle");

  useEffect(() => {
    if (!open) return;
    setDisplayName(instance?.displayName ?? template?.name ?? "");
    setConfig(instance?.config ?? {});
    setErrors({});
    setSubmitError(null);
    setTestResult(null);
  }, [open, instance, template]);

  const handle = useMemo(
    () => ({
      async save() {
        if (!template) return;
        setBusy("saving");
        setSubmitError(null);
        setErrors({});
        const result = editing && instance
          ? await update(instance.id, { displayName, config })
          : await create({ templateId: template.id, displayName, config });
        setBusy("idle");
        if (!result.ok) {
          setErrors(errorsToMap(result.errors));
          if (!result.errors || result.errors.length === 0) {
            setSubmitError(result.message ?? "Could not save integration.");
          }
          return;
        }
        if (result.integration && onSaved) onSaved(result.integration);
        onOpenChange(false);
      },
      async test() {
        if (!template) return;
        setBusy("testing");
        setTestResult(null);
        try {
          const r = await test(template.id, config, instance?.id);
          setTestResult(r);
        } finally {
          setBusy("idle");
        }
      }
    }),
    [template, editing, instance, displayName, config, create, update, test, onSaved, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit integration" : `Add ${template?.name ?? "integration"}`}
          </DialogTitle>
          <DialogDescription>
            {template?.description ?? "Configure this integration instance."}
          </DialogDescription>
        </DialogHeader>

        {template ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="displayName" className="text-xs font-medium">
                Display name<span className="ml-1 text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={template.name}
              />
            </div>

            <ConnectorForm
              template={template}
              initialValues={config}
              editing={editing}
              errors={errors}
              onChange={setConfig}
            />

            {template.requiredPermissions.length > 0 ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <p className="mb-1 font-medium">Permissions required</p>
                <ul className="ml-4 list-disc text-muted-foreground">
                  {template.requiredPermissions.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {testResult ? (
              <p
                className={`text-xs ${testResult.ok ? "text-emerald-600" : "text-destructive"}`}
              >
                {testResult.message}
              </p>
            ) : null}
            {submitError ? (
              <p className="text-xs text-destructive">{submitError}</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            type="button"
            disabled={!template || busy !== "idle"}
            onClick={() => void handle.test()}
          >
            {busy === "testing" ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : null}
            Test connection
          </Button>
          <Button
            type="button"
            disabled={!template || busy !== "idle" || !displayName.trim()}
            onClick={() => void handle.save()}
          >
            {busy === "saving" ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : null}
            {editing ? "Save changes" : "Add integration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
