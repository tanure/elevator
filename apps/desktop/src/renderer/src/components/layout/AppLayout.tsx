import type { ReactElement } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Bot,
  CheckSquare,
  ChevronsUp,
  HeartPulse,
  LayoutDashboard,
  PlugZap,
  Settings,
  StickyNote,
} from "lucide-react";
import { useAppStore } from "@renderer/stores/useAppStore";
import { CommandPalette } from "@renderer/components/palette/CommandPalette";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/notes", label: "Notes", icon: StickyNote, end: false },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, end: false },
  { to: "/integrations", label: "Integrations", icon: PlugZap, end: false },
  { to: "/agents", label: "Agents", icon: Bot, end: false },
  { to: "/diagnostics", label: "Diagnostics", icon: HeartPulse, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

export function AppLayout(): ReactElement {
  const { appInfo } = useAppStore();

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
        <nav className="flex-1 space-y-0.5 p-3">
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
