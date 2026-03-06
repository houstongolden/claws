"use client";

import { Component } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

/** Catches render/context errors so Home shows a fallback instead of a blank screen */
export class HomeErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 flex-col min-h-0 w-full items-center justify-center gap-4 px-6 py-12">
          <AlertCircle size={32} className="text-muted-foreground" />
          <p className="text-[14px] font-medium text-foreground text-center max-w-md">
            Something went wrong loading Home. The gateway may be unreachable.
          </p>
          <Link
            href="/"
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Go to Chat
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}
