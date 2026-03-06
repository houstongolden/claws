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
        "rounded-md border border-border bg-code-bg p-3 text-[12px] leading-relaxed text-muted-foreground overflow-x-auto font-[family-name:var(--font-geist-mono)]",
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
        "rounded bg-code-bg px-1.5 py-0.5 text-[12px] font-[family-name:var(--font-geist-mono)] text-foreground",
        className
      )}
    >
      {children}
    </code>
  );
}
