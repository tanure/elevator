/**
 * Render a prompt template by substituting `{{variable}}` placeholders with
 * the matching value from `vars`. Missing variables are replaced with an
 * empty string. Values are coerced to string via JSON for non-primitives.
 *
 * Kept dependency-free so it can be unit-tested without pulling in Electron.
 */
export function renderPromptTemplate(
  template: string,
  vars: Record<string, unknown>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  });
}
