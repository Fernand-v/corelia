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

const trendStyles: Record<StatTrend, string> = {
  up: "text-emerald-600",
  down: "text-red-500",
  neutral: "text-slate-500"
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
      className={cn(
        "rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white/80 p-4 shadow-sm backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        {icon && (
          <span className="shrink-0 rounded-lg bg-slate-50 p-1.5 text-slate-500">{icon}</span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
      {(trend !== undefined || description) && (
        <div className="mt-1.5 flex items-center gap-1">
          {trend !== undefined && (
            <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendStyles[trend])}>
              <TrendIcon trend={trend} />
              {trendLabel}
            </span>
          )}
          {description && !trendLabel && (
            <span className="text-xs text-slate-500">{description}</span>
          )}
          {description && trendLabel && (
            <span className="text-xs text-slate-400">{description}</span>
          )}
        </div>
      )}
    </div>
  );
};
