import * as React from "react";
import { cn } from "./utils.js";

export interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

const DefaultIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-10 w-10 text-slate-300"
    aria-hidden="true"
  >
    <circle cx="24" cy="24" r="20" />
    <path d="M24 16v8M24 32h.01" />
  </svg>
);

export const Empty = ({ title, description, action, icon, className, ...props }: EmptyProps) => {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}
      {...props}
    >
      <div className="mb-4">{icon ?? <DefaultIcon />}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
