import * as React from "react";
import { cn } from "../../lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[72px] w-full rounded-xl border border-border/90 bg-surface-1 px-3.5 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 font-[family-name:var(--font-geist-sans)] leading-relaxed",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
