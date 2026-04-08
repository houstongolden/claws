import { cn } from "../../lib/utils";

export function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "rounded-xl border border-border/80 bg-code-bg p-4 text-[12px] leading-relaxed text-muted-foreground overflow-x-auto font-[family-name:var(--font-geist-mono)] shadow-[var(--shadow-sm)]",
        className
      )}
    >
      {children}
    </pre>
  );
}

export function InlineCode({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <code
      className={cn(
        "rounded-md bg-muted/80 border border-border/50 px-1.5 py-0.5 text-[11px] font-[family-name:var(--font-geist-mono)] text-foreground",
        className
      )}
    >
      {children}
    </code>
  );
}
