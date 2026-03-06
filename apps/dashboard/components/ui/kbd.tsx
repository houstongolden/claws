import { cn } from "../../lib/utils";

export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground",
        className
      )}
    >
      {children}
    </kbd>
  );
}
