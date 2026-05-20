import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@renderer/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Top-level renderer error boundary. Catches render-time errors anywhere in
 * the route tree, forwards them to the main process for the file log, and
 * surfaces a friendly recovery card with "Copy details" + Reload buttons.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    const message = `${error.name}: ${error.message}`;
    const stack = `${error.stack ?? ""}\n\nComponent stack:${info.componentStack ?? ""}`;
    void window.elevator.app.logRendererError(message, stack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleCopy = (): void => {
    const { error, componentStack } = this.state;
    if (!error) return;
    const text = [
      `Error: ${error.name}: ${error.message}`,
      "",
      error.stack ?? "(no stack)",
      "",
      "Component stack:",
      componentStack ?? "(no component stack)"
    ].join("\n");
    void navigator.clipboard.writeText(text);
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen items-center justify-center bg-background p-8">
        <div className="max-w-lg space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elevator hit an unexpected error and the affected screen could
              not be rendered. The error has been logged. You can copy the
              details below for a bug report, then reload the app.
            </p>
          </div>

          <div className="max-h-32 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            <code className="font-mono text-destructive">
              {error.name}: {error.message}
            </code>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={this.handleCopy}>
              Copy details
            </Button>
            <Button size="sm" onClick={this.handleReload}>
              Reload app
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
