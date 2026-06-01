import { useEffect, useMemo, type ReactElement } from "react";
import { NavLink, Outlet } from "react-router-dom";
import * as Lucide from "lucide-react";
import {
  Bot,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsUp,
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  PlugZap,
  Settings,
  StickyNote,
} from "lucide-react";
import type { ViewRecord } from "@elevator/shared";
import { useAppStore } from "@renderer/stores/useAppStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useViewsStore } from "@renderer/stores/useViewsStore";
import { CommandPalette } from "@renderer/components/palette/CommandPalette";

const COLLAPSED_KEY = "ui.sidebar.collapsedGroups";

function resolveIcon(name?: string | null): typeof LayoutDashboard {
  if (!name) return LayoutDashboard;
  const lib = Lucide as unknown as Record<string, typeof LayoutDashboard>;
  return lib[name] ?? LayoutDashboard;
}

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/notes", label: "Notes", icon: StickyNote, end: false },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, end: false },
  { to: "/integrations", label: "Integrations", icon: PlugZap, end: false },
  { to: "/agents", label: "Agents", icon: Bot, end: false },
  { to: "/chat", label: "Chat", icon: MessageSquare, end: false },
  { to: "/diagnostics", label: "Diagnostics", icon: HeartPulse, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

export function AppLayout(): ReactElement {
  const { appInfo } = useAppStore();
  const { views, load: loadViews } = useViewsStore();
  const { settings, load: loadSettings, setSetting } = useSettingsStore();

  useEffect(() => {
    void loadViews();
    void loadSettings();
  }, [loadViews, loadSettings]);

  const collapsedSet = useMemo<Set<string>>(() => {
    const raw = settings[COLLAPSED_KEY];
    if (!raw) return new Set();
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return new Set(parsed.map(String));
    } catch {
      /* ignore */
    }
    return new Set();
  }, [settings]);

  const grouped = useMemo<Record<string, ViewRecord[]>>(() => {
    const out: Record<string, ViewRecord[]> = {};
    for (const v of views) {
      const g = v.groupName || "Views";
      (out[g] ??= []).push(v);
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [views]);

  const groupNames = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const toggleGroup = (name: string): void => {
    const next = new Set(collapsedSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    void setSetting(COLLAPSED_KEY, JSON.stringify([...next]));
  };

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr] bg-background text-foreground">
      <aside className="flex flex-col border-r bg-card/70">
        {/* Logo */}
        <div className="border-b p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ChevronsUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{appInfo.name}</p>
              <p className="text-xs text-muted-foreground">v{appInfo.version}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          <div className="mt-3 space-y-1 border-t pt-3">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Views
              </span>
              <NavLink
                to="/settings"
                className="text-[11px] text-primary hover:underline"
                title="Create a view from a template in Settings"
              >
                + New
              </NavLink>
            </div>
            {groupNames.length === 0 && (
              <p className="px-2 py-1 text-[11px] leading-snug text-muted-foreground">
                Create customer-style workspaces from a template in{" "}
                <NavLink to="/settings" className="text-primary hover:underline">
                  Settings → Views
                </NavLink>
                .
              </p>
            )}
          </div>
          {groupNames.length > 0 && (
            <div className="mt-1 space-y-1">
              {groupNames.map((groupName) => {
                const isCollapsed = collapsedSet.has(groupName);
                return (
                  <div key={groupName}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupName)}
                      className="flex w-full items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      <span className="truncate">{groupName}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-0.5">
                        {grouped[groupName].map((view) => {
                          const Icon = resolveIcon(view.icon);
                          return (
                            <NavLink
                              key={view.id}
                              to={`/views/${view.id}`}
                              className={({ isActive }) =>
                                `flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                                  isActive
                                    ? "bg-primary font-medium text-primary-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                }`
                              }
                            >
                              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{view.name}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer hint */}
        <div className="border-t p-3">
          <p className="text-center text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl+K</kbd>{" "}
            to search
          </p>
        </div>
      </aside>

      <main className="overflow-y-auto">
        <Outlet />
      </main>

      <CommandPalette />
    </div>
  );
}
