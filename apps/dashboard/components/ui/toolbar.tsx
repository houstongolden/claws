import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarSeparator({ className }: { className?: string }) {
  return <div className={cn("h-4 w-px bg-border", className)} />;
}

export function ToolbarLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("text-[12px] text-muted-foreground", className)}>
      {children}
    </span>
  );
}
