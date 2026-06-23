import * as React from "react";
import { cn } from "./utils.js";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

// Swiss: tag hairline neutro. El color (rojo de urgencia) solo en danger/warning.
const styles: Record<BadgeVariant, string> = {
  default: "bg-paper text-ink border-line",
  success: "bg-paper text-ink border-line",
  warning: "bg-urgent-muted text-urgent border-urgent/30",
  danger: "bg-urgent-muted text-urgent border-urgent/30",
  info: "bg-paper text-mid border-line",
  neutral: "bg-paper text-mid border-line"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export const Badge = ({ className, variant = "default", dot = false, children, ...props }: BadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        styles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-ink": variant === "default" || variant === "success",
            "bg-urgent": variant === "warning" || variant === "danger",
            "bg-faint": variant === "info" || variant === "neutral"
          })}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
