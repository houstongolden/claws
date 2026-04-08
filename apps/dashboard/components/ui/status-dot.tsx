import { cn } from "../../lib/utils";

type StatusDotVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "neutral"
  | "running";

const dotColors: Record<StatusDotVariant, string> = {
  success: "bg-success",
  error: "bg-destructive",
  warning: "bg-warning",
  info: "bg-blue-400",
  neutral: "bg-muted-foreground",
  running: "bg-blue-400",
};

export function StatusDot({
  variant = "neutral",
  pulse = false,
  className,
}: {
  variant?: StatusDotVariant;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0 ring-2 ring-background shadow-sm",
        dotColors[variant],
        variant === "success" && "ring-success/25",
        variant === "error" && "ring-destructive/20",
        variant === "running" && "ring-blue-400/30",
        pulse && "motion-safe:animate-pulse",
        className
      )}
    />
  );
}
