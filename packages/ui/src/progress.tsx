import * as React from "react";
import { cn } from "./utils.js";

type ProgressVariant = "default" | "success" | "warning" | "danger";

// Swiss: pista hairline; relleno en tinta salvo urgencia (rojo).
const trackStyles: Record<ProgressVariant, string> = {
  default: "bg-line",
  success: "bg-line",
  warning: "bg-line",
  danger: "bg-line"
};

const fillStyles: Record<ProgressVariant, string> = {
  default: "bg-ink",
  success: "bg-ink",
  warning: "bg-urgent",
  danger: "bg-urgent"
};

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md";
}

export const Progress = ({
  value,
  max = 100,
  variant = "default",
  label,
  showValue = false,
  size = "md",
  className,
  ...props
}: ProgressProps) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)} {...props}>
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between gap-2">
          {label && <span className="text-xs text-mid">{label}</span>}
          {showValue && (
            <span className="text-xs font-medium tabular-nums text-ink">
              {new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn("w-full overflow-hidden", trackStyles[variant], size === "sm" ? "h-px" : "h-0.5")}
      >
        <div
          className={cn("h-full transition-all duration-500", fillStyles[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
