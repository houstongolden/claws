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
        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
        dotColors[variant],
        pulse && "animate-pulse",
        className
      )}
    />
  );
}
