import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight transition-colors tabular-nums",
  {
    variants: {
      variant: {
        default: "border-border/80 bg-muted/50 text-foreground shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none",
        secondary: "border-transparent bg-muted/60 text-muted-foreground",
        success:
          "border-success/20 bg-success/12 text-success",
        destructive:
          "border-destructive/15 bg-destructive/10 text-destructive",
        warning:
          "border-warning/25 bg-warning/12 text-warning dark:text-warning",
        outline: "border-border/80 bg-background text-muted-foreground",
        running:
          "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
