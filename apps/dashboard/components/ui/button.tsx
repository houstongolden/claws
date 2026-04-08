import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] text-[13px] font-medium tracking-tight transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/[0.92] shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:opacity-95",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-2 hover:border-border/80 active:bg-surface-3",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-3 active:opacity-90",
        ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground active:opacity-90",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-9 h-9 px-4",
        sm: "min-h-8 h-8 px-3 text-xs",
        lg: "min-h-10 h-10 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
