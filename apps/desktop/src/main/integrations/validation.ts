import type {
  ConfigFieldDescriptor,
  ConfigValidationError,
  ConnectorConfigSchema
} from "@elevator/shared";

/**
 * Validate a config object against a connector's schema. Returns an array of
 * field-level errors; empty array means the config is valid.
 *
 * The same descriptor format is consumed by the renderer to drive a generic
 * form; running the validator on the main process is the security boundary —
 * never trust the renderer-side check alone.
 */
export function validateConfig(
  schema: ConnectorConfigSchema,
  input: Record<string, unknown>
): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];
  for (const field of schema) {
    const value = input[field.key];
    const err = validateField(field, value);
    if (err) errors.push({ field: field.key, message: err });
  }
  return errors;
}

function validateField(field: ConfigFieldDescriptor, value: unknown): string | null {
  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0);

  if (isEmpty) {
    if (field.required) return `${field.label} is required.`;
    return null;
  }

  switch (field.type) {
    case "string":
    case "secret":
    case "path":
      if (typeof value !== "string") return `${field.label} must be text.`;
      if (field.pattern && !new RegExp(field.pattern).test(value)) {
        return field.patternMessage ?? `${field.label} has invalid format.`;
      }
      return null;
    case "url":
      if (typeof value !== "string") return `${field.label} must be text.`;
      try {
        // eslint-disable-next-line no-new
        new URL(value);
      } catch {
        return `${field.label} must be a valid URL.`;
      }
      return null;
    case "number": {
      const n = typeof value === "string" ? Number(value) : (value as number);
      if (!Number.isFinite(n)) return `${field.label} must be a number.`;
      if (field.min !== undefined && n < field.min) {
        return `${field.label} must be ≥ ${field.min}.`;
      }
      if (field.max !== undefined && n > field.max) {
        return `${field.label} must be ≤ ${field.max}.`;
      }
      return null;
    }
    case "boolean":
      if (typeof value !== "boolean") return `${field.label} must be true or false.`;
      return null;
    case "select": {
      const allowed = (field.options ?? []).map((o) => o.value);
      if (typeof value !== "string" || !allowed.includes(value)) {
        return `${field.label} must be one of: ${allowed.join(", ")}.`;
      }
      return null;
    }
    default:
      return null;
  }
}
