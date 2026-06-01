import { useEffect, useRef, useState, type ReactElement } from "react";
import { Github, Plus, RefreshCw, Trash2 } from "lucide-react";
import type {
  CopilotAuthStatus,
  CopilotDeviceLogin,
  CopilotModel,
  CopilotStatus,
  ExtensionRecord,
  ViewTemplate
} from "@elevator/shared";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Separator } from "@renderer/components/ui/separator";
import { Button } from "@renderer/components/ui/button";
import { Badge } from "@renderer/components/ui/badge";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useAppStore } from "@renderer/stores/useAppStore";
import { useUpdatesStore } from "@renderer/stores/useUpdatesStore";
import { useAgentsStore } from "@renderer/stores/useAgentsStore";
import { useExtensionsStore } from "@renderer/stores/useExtensionsStore";
import { useViewTemplatesStore } from "@renderer/stores/useViewTemplatesStore";
import { useViewsStore } from "@renderer/stores/useViewsStore";

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
  const {
    providers,
    activeProvider,
    load: loadAgents,
    setProvider
  } = useAgentsStore();

  useEffect(() => {
    void load();
    void initUpdates();
    void loadAgents();
  }, [load, initUpdates, loadAgents]);

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
          <h2 className="text-sm font-semibold">AI</h2>
          <div className="rounded-md border px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active provider</span>
              <Badge variant="secondary">{activeProvider ?? "none"}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {providers.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No providers registered.
                </span>
              ) : (
                providers.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={p === activeProvider ? "default" : "outline"}
                    onClick={() => void setProvider(p)}
                  >
                    {p}
                  </Button>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Skills and agents use the provider configured on each agent. The
              active provider here is the default for ad-hoc skill runs.
            </p>
          </div>
        </section>

        <Separator />

        <CopilotSection />

        <Separator />

        <ExtensionsSection />

        <Separator />

        <ViewTemplatesSection />

        <Separator />

        <ViewsSection />

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

/**
 * Copilot configuration. Auth resolution: a token configured here (encrypted
 * via Electron safeStorage) is preferred; otherwise the SDK falls back to the
 * logged-in `gh`/Copilot CLI user. The model dropdown is populated from the
 * SDK's `listModels()` call once the user is authenticated.
 */
function CopilotSection(): ReactElement {
  const [status, setStatus] = useState<CopilotStatus | null>(null);
  const [auth, setAuth] = useState<CopilotAuthStatus | null>(null);
  const [models, setModels] = useState<CopilotModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [token, setToken] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GitHub device-flow state. `device` is non-null while a flow is in
  // progress; the renderer polls until success/cancel/expiry.
  const [device, setDevice] = useState<CopilotDeviceLogin | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string>("");
  const [deviceBusy, setDeviceBusy] = useState(false);
  const deviceTimerRef = useRef<number | null>(null);
  const deviceCancelRef = useRef(false);

  function stopDevicePolling(): void {
    deviceCancelRef.current = true;
    if (deviceTimerRef.current !== null) {
      window.clearTimeout(deviceTimerRef.current);
      deviceTimerRef.current = null;
    }
  }

  function cancelGithubLogin(): void {
    stopDevicePolling();
    setDevice(null);
    setDeviceStatus("");
    setDeviceBusy(false);
  }

  function pollOnce(deviceCode: string, intervalMs: number): void {
    deviceTimerRef.current = window.setTimeout(async () => {
      if (deviceCancelRef.current) return;
      try {
        const res = await window.elevator.copilot.pollDeviceLogin(deviceCode);
        if (deviceCancelRef.current) return;
        switch (res.status) {
          case "pending":
            pollOnce(deviceCode, intervalMs);
            return;
          case "slow_down":
            pollOnce(deviceCode, (res.interval ?? 5) * 1000);
            return;
          case "success":
            setDevice(null);
            setDeviceStatus(
              res.login
                ? `Signed in as ${res.login}.`
                : "Signed in successfully."
            );
            setDeviceBusy(false);
            await refresh();
            return;
          case "expired":
            setDevice(null);
            setDeviceStatus("Code expired. Please try again.");
            setDeviceBusy(false);
            return;
          case "denied":
            setDevice(null);
            setDeviceStatus("Authorization denied.");
            setDeviceBusy(false);
            return;
          case "error":
            setDevice(null);
            setDeviceStatus(res.error ?? "Sign-in failed.");
            setDeviceBusy(false);
            return;
        }
      } catch (err) {
        setDevice(null);
        setDeviceStatus(err instanceof Error ? err.message : String(err));
        setDeviceBusy(false);
      }
    }, intervalMs);
  }

  async function startGithubLogin(): Promise<void> {
    stopDevicePolling();
    deviceCancelRef.current = false;
    setDeviceBusy(true);
    setDeviceStatus("Requesting device code…");
    setError(null);
    try {
      const d = await window.elevator.copilot.startDeviceLogin();
      setDevice(d);
      setDeviceStatus("Waiting for you to authorize in the browser…");
      // Open the verification page automatically — the user still has to
      // paste the code to prevent CSRF.
      void window.elevator.shell.openExternal(d.verificationUri);
      pollOnce(d.deviceCode, d.interval * 1000);
    } catch (err) {
      setDevice(null);
      setDeviceStatus(err instanceof Error ? err.message : String(err));
      setDeviceBusy(false);
    }
  }

  useEffect(() => stopDevicePolling, []);

  async function refresh(): Promise<void> {
    const s = await window.elevator.copilot.getStatus();
    setStatus(s);
    setModel(s.model);
    // Auth + model list run independently — failures here shouldn't block the
    // status badge from rendering.
    void window.elevator.copilot
      .getAuthStatus()
      .then(setAuth)
      .catch(() => setAuth({ isAuthenticated: false }));
    void loadModels();
  }

  async function loadModels(): Promise<void> {
    setLoadingModels(true);
    setModelsError(null);
    try {
      const list = await window.elevator.copilot.listModels();
      setModels(list);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : String(err));
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      if (model && model !== status?.model) {
        await window.elevator.copilot.setModel(model);
      }
      if (token.trim()) {
        await window.elevator.copilot.setToken(token.trim());
        setToken("");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function clear(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await window.elevator.copilot.clearToken();
      setToken("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const badge: { label: string; variant: "default" | "secondary" | "destructive" } =
    status == null
      ? { label: "Loading…", variant: "secondary" }
      : !status.encryptionAvailable
        ? { label: "Encryption unavailable", variant: "destructive" }
        : auth?.isAuthenticated
          ? {
              label: status.configured
                ? `Token (${auth.login ?? auth.authType ?? "user"})`
                : `Signed in via ${auth.authType ?? "gh-cli"}${auth.login ? ` · ${auth.login}` : ""}`,
              variant: "default"
            }
          : status.configured
            ? { label: "Token set", variant: "default" }
            : { label: "Not signed in", variant: "secondary" };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Copilot</h2>
      <div className="rounded-md border px-3 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        {auth && !auth.isAuthenticated && (
          <p className="text-[11px] text-muted-foreground">
            Sign in with the button below (no <code>gh</code> CLI required), or
            paste a personal access token in the field further down.
          </p>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={auth?.isAuthenticated ? "outline" : "default"}
              onClick={() => void startGithubLogin()}
              disabled={deviceBusy || device !== null}
            >
              <Github className="mr-1.5 h-3.5 w-3.5" />
              {auth?.isAuthenticated
                ? "Sign in with GitHub (switch account)"
                : "Sign in with GitHub"}
            </Button>
            {device && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={cancelGithubLogin}
              >
                Cancel
              </Button>
            )}
          </div>
          {device && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1.5">
              <p className="text-xs text-muted-foreground">
                1. Open{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() =>
                    void window.elevator.shell.openExternal(
                      device.verificationUri
                    )
                  }
                >
                  {device.verificationUri}
                </button>{" "}
                in your browser.
              </p>
              <p className="text-xs text-muted-foreground">
                2. Enter this one-time code:
              </p>
              <div className="flex items-center gap-2">
                <code className="select-all rounded bg-background px-2 py-1 font-mono text-base tracking-widest">
                  {device.userCode}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void navigator.clipboard.writeText(device.userCode)
                  }
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
          {deviceStatus && !device && (
            <p className="text-[11px] text-muted-foreground">{deviceStatus}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="copilot-token">GitHub token (optional)</Label>
          <Input
            id="copilot-token"
            type="password"
            placeholder={
              status?.configured
                ? "•••••••• (stored)"
                : "Leave blank to use the gh CLI logged-in user"
            }
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            Encrypted at rest via Electron safeStorage. Requires an active
            Copilot subscription. Skip this field to authenticate as the
            logged-in <code>gh</code> CLI user.
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="copilot-model">Default model</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void loadModels()}
              disabled={loadingModels}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {loadingModels ? "Loading…" : "Refresh"}
            </Button>
          </div>
          {models.length > 0 ? (
            <select
              id="copilot-model"
              aria-label="Default model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {!models.some((m) => m.id === model) && model && (
                <option value={model}>{model} (current)</option>
              )}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.multiplier && m.multiplier !== 1
                    ? ` · ${m.multiplier}x`
                    : ""}
                  {m.policy && m.policy !== "enabled" ? ` · ${m.policy}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="copilot-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-5"
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            {modelsError
              ? `Could not load models: ${modelsError}`
              : models.length > 0
                ? `${models.length} models available. Used as default when a chat or agent doesn't pick its own.`
                : "Model list loads after authentication. Falls back to free-text input until then."}
          </p>
        </div>
        {error && <div className="text-xs text-destructive">{error}</div>}
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void clear()}
            disabled={saving || !status?.configured}
          >
            Clear token
          </Button>
        </div>
      </div>
    </section>
  );
}

// ── Extensions ──────────────────────────────────────────────────────────────

function ExtensionsSection(): ReactElement {
  const { extensions, load, create, update, remove } = useExtensionsStore();
  const { agents, load: loadAgents } = useAgentsStore();
  const [editing, setEditing] = useState<ExtensionRecord | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void load();
    void loadAgents();
  }, [load, loadAgents]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Extensions</h2>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          New
        </Button>
      </div>
      {extensions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No extensions yet. Extensions wrap an agent's latest output in a
          dashboard card.
        </p>
      ) : (
        <ul className="space-y-1">
          {extensions.map((ext) => (
            <li
              key={ext.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {ext.title}{" "}
                  {!ext.isEnabled && (
                    <Badge variant="secondary" className="ml-1">
                      disabled
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {ext.description || "No description"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(ext)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Delete extension "${ext.title}"?`)) {
                      void remove(ext.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(creating || editing) && (
        <ExtensionDialog
          initial={editing}
          agents={agents.map((a) => ({ id: a.id, name: a.name }))}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={async (form) => {
            if (editing) {
              await update(editing.id, form);
            } else {
              await create({
                title: form.title ?? "Untitled",
                description: form.description,
                agentId: form.agentId,
                refreshSchedule: form.refreshSchedule,
                renderHints: form.renderHints,
                isEnabled: form.isEnabled
              });
            }
          }}
        />
      )}
    </section>
  );
}

interface ExtensionForm {
  title?: string;
  description?: string;
  agentId?: string | null;
  refreshSchedule?: string;
  renderHints?: { colSpan?: 1 | 2 };
  isEnabled?: boolean;
}

function ExtensionDialog(props: {
  initial: ExtensionRecord | null;
  agents: { id: string; name: string }[];
  onClose: () => void;
  onSave: (form: ExtensionForm) => Promise<void>;
}): ReactElement {
  const { initial, agents, onClose, onSave } = props;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [agentId, setAgentId] = useState(initial?.agentId ?? "");
  const [refreshSchedule, setRefreshSchedule] = useState(
    initial?.refreshSchedule ?? ""
  );
  const [colSpan, setColSpan] = useState<1 | 2>(
    initial?.renderHints.colSpan === 2 ? 2 : 1
  );
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        agentId: agentId || null,
        refreshSchedule: refreshSchedule.trim(),
        renderHints: { colSpan },
        isEnabled
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-lg border bg-card p-5 shadow-xl"
      >
        <h3 className="text-sm font-semibold">
          {initial ? "Edit extension" : "New extension"}
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="ext-title">Title</Label>
          <Input
            id="ext-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ext-desc">Description</Label>
          <Input
            id="ext-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ext-agent">Agent</Label>
          <select
            id="ext-agent"
            value={agentId ?? ""}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">— No agent —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ext-sched">Refresh schedule</Label>
          <Input
            id="ext-sched"
            placeholder="e.g. every 15m"
            value={refreshSchedule}
            onChange={(e) => setRefreshSchedule(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>Column span</Label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={colSpan === 1 ? "default" : "outline"}
              onClick={() => setColSpan(1)}
            >
              1×
            </Button>
            <Button
              size="sm"
              variant={colSpan === 2 ? "default" : "outline"}
              onClick={() => setColSpan(2)}
            >
              2×
            </Button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
}

// ── View templates ──────────────────────────────────────────────────────────

function ViewTemplatesSection(): ReactElement {
  const { templates, load, remove } = useViewTemplatesStore();

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">View templates</h2>
      {templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">No templates available.</p>
      ) : (
        <ul className="space-y-1">
          {templates.map((tpl) => (
            <li
              key={tpl.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {tpl.name}{" "}
                  {tpl.isBuiltIn && (
                    <Badge variant="secondary" className="ml-1">
                      built-in
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Group: {tpl.body.groupName} · {tpl.body.slots.length} cards
                </p>
              </div>
              {!tpl.isBuiltIn && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Delete template "${tpl.name}"?`)) {
                      void remove(tpl.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Views ───────────────────────────────────────────────────────────────────

function ViewsSection(): ReactElement {
  const { views, load: loadViews, remove, createFromTemplate } = useViewsStore();
  const { templates, load: loadTemplates } = useViewTemplatesStore();
  const [picking, setPicking] = useState<ViewTemplate | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    void loadViews();
    void loadTemplates();
  }, [loadViews, loadTemplates]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Views</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPickerOpen((v) => !v)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New from template
        </Button>
      </div>
      {pickerOpen && (
        <div className="rounded-md border bg-popover p-2 text-xs">
          {templates.length === 0 ? (
            <p className="text-muted-foreground">No templates.</p>
          ) : (
            templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent"
                onClick={() => {
                  setPicking(tpl);
                  setPickerOpen(false);
                }}
              >
                {tpl.name}
              </button>
            ))
          )}
        </div>
      )}
      {views.length === 0 ? (
        <p className="text-xs text-muted-foreground">No views yet.</p>
      ) : (
        <ul className="space-y-1">
          {views.map((view) => (
            <li
              key={view.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{view.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {view.groupName}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(`Delete view "${view.name}"?`)) {
                    void remove(view.id);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {picking && (
        <NewViewDialog
          template={picking}
          onClose={() => setPicking(null)}
          onCreate={async (input) => {
            await createFromTemplate(picking.id, input);
          }}
        />
      )}
    </section>
  );
}

function NewViewDialog(props: {
  template: ViewTemplate;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    groupName?: string;
    parameters: Record<string, unknown>;
  }) => Promise<void>;
}): ReactElement {
  const { template, onClose, onCreate } = props;
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState(template.body.groupName);
  const [params, setParams] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of template.body.parameters) {
      init[p.name] = p.defaultValue ?? "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (): Promise<void> => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    for (const p of template.body.parameters) {
      if (p.required && !params[p.name]?.trim()) {
        setError(`"${p.label}" is required.`);
        return;
      }
    }
    setError(null);
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        groupName: groupName.trim() || undefined,
        parameters: { ...params }
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        className="fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-lg border bg-card p-5 shadow-xl"
      >
        <h3 className="text-sm font-semibold">
          New view · {template.name}
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="view-name">Name</Label>
          <Input
            id="view-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="view-group">Group</Label>
          <Input
            id="view-group"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>
        {template.body.parameters.map((p) => (
          <div key={p.name} className="space-y-1.5">
            <Label htmlFor={`view-p-${p.name}`}>
              {p.label}
              {p.required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id={`view-p-${p.name}`}
              value={params[p.name] ?? ""}
              onChange={(e) =>
                setParams((cur) => ({ ...cur, [p.name]: e.target.value }))
              }
            />
          </div>
        ))}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleCreate()} disabled={saving}>
            Create
          </Button>
        </div>
      </div>
    </>
  );
}