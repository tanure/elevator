import { useMemo, useState, type ReactElement } from "react";
import type {
  ConfigFieldDescriptor,
  ConnectorTemplate
} from "@elevator/shared";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Textarea } from "@renderer/components/ui/textarea";

export type ConfigFormValue = string | number | boolean | { secretRef: true };

export interface ConnectorFormProps {
  template: ConnectorTemplate;
  initialValues?: Record<string, unknown>;
  /** True when editing an existing instance — secret fields show a placeholder. */
  editing?: boolean;
  /** Field-level errors keyed by field key (from the main process validator). */
  errors?: Record<string, string>;
  onChange: (values: Record<string, unknown>) => void;
}

const SECRET_PLACEHOLDER = "••••••••";

function defaultValueFor(field: ConfigFieldDescriptor): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  switch (field.type) {
    case "boolean":
      return false;
    case "number":
      return "";
    default:
      return "";
  }
}

function isExistingSecretRef(v: unknown): boolean {
  return Boolean(v && typeof v === "object" && (v as { secretRef?: boolean }).secretRef);
}

/**
 * Renders a generic form derived from a connector's `configSchema`. Validation
 * is light client-side (required + type coercion) and authoritative validation
 * runs in the main process via the registry.
 */
export function ConnectorForm({
  template,
  initialValues,
  editing,
  errors,
  onChange
}: ConnectorFormProps): ReactElement {
  const initial = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const field of template.configSchema) {
      const seeded = initialValues?.[field.key];
      out[field.key] = seeded !== undefined ? seeded : defaultValueFor(field);
    }
    return out;
  }, [template.configSchema, initialValues]);

  const [values, setValues] = useState<Record<string, unknown>>(initial);

  const update = (key: string, value: unknown): void => {
    const next = { ...values, [key]: value };
    setValues(next);
    onChange(next);
  };

  if (template.configSchema.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This connector has no configuration options.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {template.configSchema.map((field) => {
        const fieldError = errors?.[field.key];
        const fieldId = `field-${field.key}`;
        const current = values[field.key];
        const labelEl = (
          <Label htmlFor={fieldId} className="text-xs font-medium">
            {field.label}
            {field.required ? <span className="ml-1 text-destructive">*</span> : null}
          </Label>
        );

        if (field.type === "boolean") {
          return (
            <div key={field.key} className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={field.label}
                title={field.label}
                className="mt-0.5 h-4 w-4 rounded border-input"
                checked={Boolean(current)}
                onChange={(e) => update(field.key, e.target.checked)}
              />
              <div className="space-y-1">
                <span className="text-xs font-medium">
                  {field.label}
                  {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                </span>
                {field.help ? (
                  <p className="text-xs text-muted-foreground">{field.help}</p>
                ) : null}
                {fieldError ? (
                  <p className="text-xs text-destructive">{fieldError}</p>
                ) : null}
              </div>
            </div>
          );
        }

        if (field.type === "select") {
          return (
            <div key={field.key} className="space-y-1">
              {labelEl}
              <select
                id={fieldId}
                aria-label={field.label}
                title={field.label}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={typeof current === "string" ? current : ""}
                onChange={(e) => update(field.key, e.target.value)}
              >
                <option value="">— Select —</option>
                {(field.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {field.help ? (
                <p className="text-xs text-muted-foreground">{field.help}</p>
              ) : null}
              {fieldError ? (
                <p className="text-xs text-destructive">{fieldError}</p>
              ) : null}
            </div>
          );
        }

        const isSecret = field.type === "secret";
        const isMultiline = field.type === "multiline";
        const isLong =
          isMultiline || (field.type === "string" && (field.help ?? "").length > 80);
        const inputType =
          field.type === "number"
            ? "number"
            : isSecret
              ? "password"
              : field.type === "url"
                ? "url"
                : "text";

        const display = isSecret && isExistingSecretRef(current)
          ? ""
          : typeof current === "number"
            ? String(current)
            : typeof current === "string"
              ? current
              : "";

        const placeholder = isSecret && editing && isExistingSecretRef(initial[field.key])
          ? SECRET_PLACEHOLDER + " (leave blank to keep)"
          : field.placeholder;

        return (
          <div key={field.key} className="space-y-1">
            {labelEl}
            {isLong ? (
              <Textarea
                id={fieldId}
                placeholder={placeholder}
                value={display}
                onChange={(e) => update(field.key, e.target.value)}
              />
            ) : (
              <Input
                id={fieldId}
                type={inputType}
                placeholder={placeholder}
                value={display}
                min={field.min}
                max={field.max}
                onChange={(e) => {
                  if (field.type === "number") {
                    const raw = e.target.value;
                    update(field.key, raw === "" ? "" : Number(raw));
                  } else {
                    update(field.key, e.target.value);
                  }
                }}
              />
            )}
            {field.help ? (
              <p className="text-xs text-muted-foreground">{field.help}</p>
            ) : null}
            {fieldError ? (
              <p className="text-xs text-destructive">{fieldError}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
