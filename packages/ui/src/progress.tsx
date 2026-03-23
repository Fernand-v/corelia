import * as React from "react";
import { cn } from "./utils.js";

type ProgressVariant = "default" | "success" | "warning" | "danger";

const trackStyles: Record<ProgressVariant, string> = {
  default: "bg-slate-100",
  success: "bg-emerald-50",
  warning: "bg-amber-50",
  danger: "bg-red-50"
};

const fillStyles: Record<ProgressVariant, string> = {
  default: "bg-slate-700",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500"
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
          {label && <span className="text-xs text-slate-600">{label}</span>}
          {showValue && (
            <span className="text-xs font-medium text-slate-700">
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
        className={cn("w-full overflow-hidden rounded-full", trackStyles[variant], size === "sm" ? "h-1.5" : "h-2")}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", fillStyles[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
