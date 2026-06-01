import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Bot, Play, Plus, RefreshCcw, Trash2, Wrench } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@renderer/components/ui/card";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ui/dialog";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Textarea } from "@renderer/components/ui/textarea";
import { useAgentsStore } from "@renderer/stores/useAgentsStore";
import type {
  AgentRecord,
  AgentRunStatus,
  AgentSchedule,
  AgentTool,
  AiProviderName,
  SkillRecord
} from "@elevator/shared";

type TabKey = "skills" | "agents" | "history";

function statusVariant(
  status: AgentRunStatus
): "default" | "destructive" | "secondary" {
  switch (status) {
    case "succeeded":
      return "default";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}

export function Agents(): ReactElement {
  const {
    skills,
    agents,
    availableTools,
    history,
    running,
    load,
    runSkill,
    deleteSkill,
    deleteAgent
  } = useAgentsStore();

  const [tab, setTab] = useState<TabKey>("skills");
  const [skillDialog, setSkillDialog] = useState<{
    open: boolean;
    editing: SkillRecord | null;
  }>({ open: false, editing: null });
  const [agentDialog, setAgentDialog] = useState<{
    open: boolean;
    editing: AgentRecord | null;
  }>({ open: false, editing: null });
  const [runDialog, setRunDialog] = useState<{
    open: boolean;
    skill: SkillRecord | null;
  }>({ open: false, skill: null });

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Author skills, configure agents, and review runs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b">
        {(["skills", "agents", "history"] as TabKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              "px-3 py-2 text-sm font-medium capitalize border-b-2 -mb-px " +
              (tab === k
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {k}
          </button>
        ))}
      </div>

      {tab === "skills" && (
        <SkillsTab
          skills={skills}
          running={running}
          onCreate={() => setSkillDialog({ open: true, editing: null })}
          onEdit={(s) => setSkillDialog({ open: true, editing: s })}
          onRun={(s) => setRunDialog({ open: true, skill: s })}
          onDelete={(s) => {
            if (confirm(`Delete skill "${s.name}"?`)) void deleteSkill(s.id);
          }}
        />
      )}

      {tab === "agents" && (
        <AgentsTab
          agents={agents}
          skills={skills}
          onCreate={() => setAgentDialog({ open: true, editing: null })}
          onEdit={(a) => setAgentDialog({ open: true, editing: a })}
          onDelete={(a) => {
            if (confirm(`Delete agent "${a.name}"?`)) void deleteAgent(a.id);
          }}
        />
      )}

      {tab === "history" && <HistoryTab history={history} />}

      <SkillDialog
        open={skillDialog.open}
        editing={skillDialog.editing}
        availableTools={availableTools}
        onClose={() => setSkillDialog({ open: false, editing: null })}
      />

      <AgentDialog
        open={agentDialog.open}
        editing={agentDialog.editing}
        skills={skills}
        onClose={() => setAgentDialog({ open: false, editing: null })}
      />

      <RunSkillDialog
        open={runDialog.open}
        skill={runDialog.skill}
        running={running}
        onRun={(input) => {
          if (!runDialog.skill) return;
          void runSkill(runDialog.skill.id, input).finally(() => {
            setRunDialog({ open: false, skill: null });
            setTab("history");
          });
        }}
        onClose={() => setRunDialog({ open: false, skill: null })}
      />
    </div>
  );
}

// ── Skills tab ───────────────────────────────────────────────────────────────

function SkillsTab(props: {
  skills: SkillRecord[];
  running: boolean;
  onCreate: () => void;
  onEdit: (s: SkillRecord) => void;
  onRun: (s: SkillRecord) => void;
  onDelete: (s: SkillRecord) => void;
}): ReactElement {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={props.onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New skill
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {props.skills.length === 0 && (
          <p className="text-sm text-muted-foreground">No skills yet.</p>
        )}
        {props.skills.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  {s.name}
                </span>
                {s.isBuiltIn && (
                  <Badge variant="outline" className="text-[10px]">
                    built-in
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">{s.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.allowedTools.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.allowedTools.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      <Wrench className="mr-1 h-3 w-3" />
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={props.running}
                  onClick={() => props.onRun(s)}
                >
                  <Play className="mr-2 h-3 w-3" />
                  Run
                </Button>
                <Button size="sm" variant="outline" onClick={() => props.onEdit(s)}>
                  Edit
                </Button>
                {!s.isBuiltIn && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => props.onDelete(s)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Agents tab ───────────────────────────────────────────────────────────────

function AgentsTab(props: {
  agents: AgentRecord[];
  skills: SkillRecord[];
  onCreate: () => void;
  onEdit: (a: AgentRecord) => void;
  onDelete: (a: AgentRecord) => void;
}): ReactElement {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={props.onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New agent
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {props.agents.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No agents yet. Create one to bind skills to a provider and tool budget.
          </p>
        )}
        {props.agents.map((a) => (
          <Card key={a.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>{a.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {a.provider}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">{a.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {a.skillIds.map((id) => {
                  const skill = props.skills.find((s) => s.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="text-[10px]">
                      {skill?.name ?? id}
                    </Badge>
                  );
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Max tool calls: {a.maxToolCalls}
                {a.model ? ` · model: ${a.model}` : ""}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => props.onEdit(a)}>
                  Edit
                </Button>
                {!a.isBuiltIn && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => props.onDelete(a)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── History tab ──────────────────────────────────────────────────────────────

function HistoryTab(props: {
  history: ReturnType<typeof useAgentsStore.getState>["history"];
}): ReactElement {
  return (
    <ScrollArea className="h-[560px] rounded-md border">
      <div className="space-y-2 p-3">
        {props.history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No runs yet.</p>
        ) : (
          props.history.map((run) => (
            <Card key={run.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-mono">
                    {run.skillId}
                  </CardTitle>
                  <Badge variant={statusVariant(run.status)} className="text-[10px]">
                    {run.status}
                  </Badge>
                </div>
                <CardDescription className="text-[10px]">
                  {new Date(run.startedAt).toLocaleString()}
                  {run.toolCalls.length > 0
                    ? ` · ${run.toolCalls.length} tool call${run.toolCalls.length === 1 ? "" : "s"}`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {run.error ?? run.output ?? ""}
                </pre>
                {run.toolCalls.length > 0 && (
                  <details className="mt-2 text-[11px]">
                    <summary className="cursor-pointer text-muted-foreground">
                      Tool calls
                    </summary>
                    <ul className="mt-1 space-y-1 pl-4">
                      {run.toolCalls.map((tc, i) => (
                        <li key={i} className="font-mono">
                          <span
                            className={tc.ok ? "text-foreground" : "text-destructive"}
                          >
                            {tc.toolId}
                          </span>
                          {tc.error ? ` — ${tc.error}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ScrollArea>
  );
}

// ── Skill dialog ─────────────────────────────────────────────────────────────

function SkillDialog(props: {
  open: boolean;
  editing: SkillRecord | null;
  availableTools: AgentTool[];
  onClose: () => void;
}): ReactElement {
  const { createSkill, updateSkill } = useAgentsStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [inputVarsText, setInputVarsText] = useState("");
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    const e = props.editing;
    setName(e?.name ?? "");
    setDescription(e?.description ?? "");
    setSystemPrompt(e?.systemPrompt ?? "");
    setPromptTemplate(e?.promptTemplate ?? "");
    setInputVarsText((e?.inputVariables ?? []).join("\n"));
    setAllowed(new Set(e?.allowedTools ?? []));
  }, [props.open, props.editing]);

  const grouped = useMemo(() => {
    const m = new Map<string, AgentTool[]>();
    for (const t of props.availableTools) {
      const arr = m.get(t.instanceName) ?? [];
      arr.push(t);
      m.set(t.instanceName, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [props.availableTools]);

  const toggle = (id: string): void => {
    setAllowed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const inputVariables = inputVarsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        name: name.trim(),
        description: description.trim(),
        systemPrompt,
        promptTemplate,
        inputVariables,
        allowedTools: Array.from(allowed)
      };
      if (props.editing) {
        await updateSkill(props.editing.id, payload);
      } else {
        await createSkill(payload);
      }
      props.onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.editing ? "Edit skill" : "New skill"}</DialogTitle>
          <DialogDescription>
            Skills define a system prompt, a prompt template, and the tools the
            model is allowed to call.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summarise inbox"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-desc">Description</Label>
            <Input
              id="skill-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-system">System prompt</Label>
            <Textarea
              id="skill-system"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-template">
              Prompt template ({"{{variable}}"} placeholders)
            </Label>
            <Textarea
              id="skill-template"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              rows={5}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-vars">Input variables (one per line)</Label>
            <Textarea
              id="skill-vars"
              value={inputVarsText}
              onChange={(e) => setInputVarsText(e.target.value)}
              rows={3}
              placeholder={"topic\nbody"}
            />
          </div>
          <div className="grid gap-2">
            <Label>Allowed tools</Label>
            {grouped.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No connected integrations expose tools yet.
              </p>
            ) : (
              <div className="space-y-2 rounded-md border p-2">
                {grouped.map(([instance, tools]) => (
                  <div key={instance}>
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                      {instance}
                    </div>
                    {tools.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-start gap-2 py-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={allowed.has(t.id)}
                          onChange={() => toggle(t.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-mono">{t.id}</div>
                          <div className="text-muted-foreground">{t.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !name.trim()}>
            {props.editing ? "Save changes" : "Create skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Agent dialog ─────────────────────────────────────────────────────────────

function AgentDialog(props: {
  open: boolean;
  editing: AgentRecord | null;
  skills: SkillRecord[];
  onClose: () => void;
}): ReactElement {
  const { createAgent, updateAgent, providers, availableTools } = useAgentsStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<AiProviderName>("echo");
  const [model, setModel] = useState("");
  const [maxToolCalls, setMaxToolCalls] = useState(5);
  const [skillIds, setSkillIds] = useState<Set<string>>(new Set());
  const [systemPrompt, setSystemPrompt] = useState("");
  const [goal, setGoal] = useState("");
  const [allowedTools, setAllowedTools] = useState<Set<string>>(new Set());
  const [scheduleKind, setScheduleKind] =
    useState<AgentSchedule["kind"]>("none");
  const [scheduleMinutes, setScheduleMinutes] = useState(15);
  const [scheduleHour, setScheduleHour] = useState(9);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    const e = props.editing;
    setName(e?.name ?? "");
    setDescription(e?.description ?? "");
    setProvider(e?.provider ?? "echo");
    setModel(e?.model ?? "");
    setMaxToolCalls(e?.maxToolCalls ?? 5);
    setSkillIds(new Set(e?.skillIds ?? []));
    setSystemPrompt(e?.systemPrompt ?? "");
    setGoal(e?.goal ?? "");
    setAllowedTools(new Set(e?.allowedTools ?? []));
    const sched = e?.schedule ?? { kind: "none" as const };
    setScheduleKind(sched.kind);
    if (sched.kind === "every-minutes") {
      setScheduleMinutes(sched.minutes);
    } else if (sched.kind === "daily") {
      setScheduleHour(sched.hour);
      setScheduleMinute(sched.minute);
    }
  }, [props.open, props.editing]);

  const toggleSkill = (id: string): void => {
    setSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTool = (id: string): void => {
    setAllowedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildSchedule = (): AgentSchedule => {
    if (scheduleKind === "every-minutes") {
      return { kind: "every-minutes", minutes: Math.max(1, scheduleMinutes) };
    }
    if (scheduleKind === "daily") {
      return {
        kind: "daily",
        hour: Math.min(23, Math.max(0, scheduleHour)),
        minute: Math.min(59, Math.max(0, scheduleMinute))
      };
    }
    return { kind: "none" };
  };

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        provider,
        model: model.trim() || null,
        maxToolCalls,
        skillIds: Array.from(skillIds),
        systemPrompt,
        goal,
        allowedTools: Array.from(allowedTools),
        schedule: buildSchedule()
      };
      if (props.editing) {
        await updateAgent(props.editing.id, payload);
      } else {
        await createAgent(payload);
      }
      props.onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.editing ? "Edit agent" : "New agent"}</DialogTitle>
          <DialogDescription>
            Agents pair a provider, persona, and tool budget. They can run on a
            schedule against a standing goal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agent-desc">Description</Label>
            <Input
              id="agent-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="agent-provider">Provider</Label>
              <select
                id="agent-provider"
                aria-label="Provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as AiProviderName)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="agent-max">Max tool calls</Label>
              <Input
                id="agent-max"
                type="number"
                min={0}
                max={20}
                value={maxToolCalls}
                onChange={(e) => setMaxToolCalls(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agent-model">Model (optional)</Label>
            <Input
              id="agent-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="provider-specific"
            />
          </div>
          <div className="grid gap-2">
            <Label>Skills</Label>
            <div className="space-y-1 rounded-md border p-2">
              {props.skills.length === 0 && (
                <p className="text-xs text-muted-foreground">No skills available.</p>
              )}
              {props.skills.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={skillIds.has(s.id)}
                    onChange={() => toggleSkill(s.id)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agent-system">System prompt</Label>
            <Textarea
              id="agent-system"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Persistent persona, rules, formatting hints."
              rows={4}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agent-goal">Goal</Label>
            <Textarea
              id="agent-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What the agent should do every time it runs on its schedule."
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Allowed tools</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {availableTools.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No tools available. Connect integrations under Settings.
                </p>
              )}
              {availableTools.map((t) => (
                <label key={t.id} className="flex items-center gap-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={allowedTools.has(t.id)}
                    onChange={() => toggleTool(t.id)}
                  />
                  <span className="font-mono">{t.id}</span>
                  {t.description && (
                    <span className="text-muted-foreground">— {t.description}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Schedule</Label>
            <div className="space-y-2 rounded-md border p-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="schedule-kind"
                  checked={scheduleKind === "none"}
                  onChange={() => setScheduleKind("none")}
                />
                <span>None (manual only)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="schedule-kind"
                  checked={scheduleKind === "every-minutes"}
                  onChange={() => setScheduleKind("every-minutes")}
                />
                <span>Every</span>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={scheduleMinutes}
                  onChange={(e) =>
                    setScheduleMinutes(Number(e.target.value) || 1)
                  }
                  disabled={scheduleKind !== "every-minutes"}
                  className="h-7 w-20"
                />
                <span>minutes</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="schedule-kind"
                  checked={scheduleKind === "daily"}
                  onChange={() => setScheduleKind("daily")}
                />
                <span>Daily at</span>
                <Input
                  type="time"
                  value={`${String(scheduleHour).padStart(2, "0")}:${String(
                    scheduleMinute
                  ).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":");
                    setScheduleHour(Number(h) || 0);
                    setScheduleMinute(Number(m) || 0);
                  }}
                  disabled={scheduleKind !== "daily"}
                  className="h-7 w-28"
                />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !name.trim()}>
            {props.editing ? "Save changes" : "Create agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Run skill dialog ─────────────────────────────────────────────────────────

function RunSkillDialog(props: {
  open: boolean;
  skill: SkillRecord | null;
  running: boolean;
  onRun: (input: Record<string, unknown>) => void;
  onClose: () => void;
}): ReactElement {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (props.open && props.skill) {
      const init: Record<string, string> = {};
      for (const v of props.skill.inputVariables) init[v] = "";
      setValues(init);
    }
  }, [props.open, props.skill]);

  if (!props.skill) {
    return <Dialog open={false} onOpenChange={() => undefined}><DialogContent /></Dialog>;
  }
  const skill = props.skill;

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run {skill.name}</DialogTitle>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {skill.inputVariables.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This skill takes no inputs.
            </p>
          ) : (
            skill.inputVariables.map((v) => (
              <div key={v} className="grid gap-2">
                <Label htmlFor={`var-${v}`}>{v}</Label>
                <Textarea
                  id={`var-${v}`}
                  rows={2}
                  value={values[v] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [v]: e.target.value }))
                  }
                />
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose} disabled={props.running}>
            Cancel
          </Button>
          <Button onClick={() => props.onRun(values)} disabled={props.running}>
            <Play className="mr-2 h-3 w-3" />
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
