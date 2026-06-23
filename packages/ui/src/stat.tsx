import * as React from "react";
import { cn } from "./utils.js";

type StatTrend = "up" | "down" | "neutral";

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  description?: string | undefined;
  trend?: StatTrend;
  trendLabel?: string | undefined;
  icon?: React.ReactNode;
}

// Swiss: sin verde semántico. Caída → rojo de urgencia; resto en tinta/gris.
const trendStyles: Record<StatTrend, string> = {
  up: "text-ink",
  down: "text-urgent",
  neutral: "text-mid"
};

const TrendIcon = ({ trend }: { trend: StatTrend }) => {
  if (trend === "up") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M8 3l5 5H9v5H7V8H3l5-5z" />
      </svg>
    );
  }
  if (trend === "down") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M8 13L3 8h4V3h2v5h4l-5 5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M2 8h12v1H2z" />
    </svg>
  );
};

export const Stat = ({ label, value, description, trend, trendLabel, icon, className, ...props }: StatProps) => {
  return (
    <div
      className={cn("border border-line bg-paper p-4", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-widest text-faint">{label}</p>
        {icon && <span className="shrink-0 text-faint">{icon}</span>}
      </div>
      <p className="mt-2 font-condensed text-4xl font-bold tabular-nums tracking-tight text-ink">{value}</p>
      {(trend !== undefined || description) && (
        <div className="mt-1.5 flex items-center gap-1">
          {trend !== undefined && (
            <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendStyles[trend])}>
              <TrendIcon trend={trend} />
              {trendLabel}
            </span>
          )}
          {description && !trendLabel && (
            <span className="text-xs text-mid">{description}</span>
          )}
          {description && trendLabel && (
            <span className="text-xs text-faint">{description}</span>
          )}
        </div>
      )}
    </div>
  );
};
