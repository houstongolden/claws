"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[Claws]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-foreground">
          <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/50"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
          <p className="mt-6 text-xs text-muted-foreground">
            Hard refresh (⌘⇧R) if the app stays blank — often fixed by clearing site data for localhost.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
