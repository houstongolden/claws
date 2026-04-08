import * as React from "react";
import { cn } from "../../lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      className={cn(
        "flex min-h-9 h-9 w-full rounded-xl border border-border/90 bg-surface-1 px-3 text-[13px] text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 font-[family-name:var(--font-geist-sans)]",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

export { Select };
