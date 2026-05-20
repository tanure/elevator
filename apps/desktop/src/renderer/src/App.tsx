import { useEffect, type ReactElement } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { useAppStore } from "@renderer/stores/useAppStore";
import { AppLayout } from "@renderer/components/layout/AppLayout";
import { UpdateDialog } from "@renderer/components/UpdateDialog";
import { ErrorBoundary } from "@renderer/components/ErrorBoundary";
import { Dashboard } from "@renderer/routes/Dashboard";
import { Notes } from "@renderer/routes/Notes";
import { Tasks } from "@renderer/routes/Tasks";
import { Integrations } from "@renderer/routes/Integrations";
import { Agents } from "@renderer/routes/Agents";
import { Settings } from "@renderer/routes/Settings";
import { Diagnostics } from "@renderer/routes/Diagnostics";

// Register all built-in dashboard cards before first render
import "@renderer/components/cards/register";

export function App(): ReactElement {
  const { setAppInfo } = useAppStore();

  useEffect(() => {
    void window.elevator.getAppInfo().then(setAppInfo);
  }, [setAppInfo]);

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="notes" element={<Notes />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="agents" element={<Agents />} />
            <Route path="settings" element={<Settings />} />
            <Route path="diagnostics" element={<Diagnostics />} />
          </Route>
        </Routes>
        <UpdateDialog />
      </HashRouter>
    </ErrorBoundary>
  );
}

