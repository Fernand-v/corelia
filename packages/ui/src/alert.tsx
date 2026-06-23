import * as React from "react";
import { cn } from "./utils.js";

type AlertVariant = "info" | "success" | "warning" | "danger";

// Swiss: aviso hairline; rojo de urgencia solo en warning/danger.
const containerStyles: Record<AlertVariant, string> = {
  info: "bg-paper border-line text-ink",
  success: "bg-paper border-line text-ink",
  warning: "bg-urgent-muted border-urgent/30 text-ink",
  danger: "bg-urgent-muted border-urgent/30 text-ink"
};

const iconColor: Record<AlertVariant, string> = {
  info: "text-mid",
  success: "text-ink",
  warning: "text-urgent",
  danger: "text-urgent"
};

const AlertIcon = ({ variant }: { variant: AlertVariant }) => {
  if (variant === "success") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
    );
  }
  if (variant === "danger") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  );
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
}

export const Alert = ({ variant = "info", title, children, className, ...props }: AlertProps) => {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-xl border p-3 text-sm",
        containerStyles[variant],
        className
      )}
      {...props}
    >
      <span className={cn("mt-px", iconColor[variant])}>
        <AlertIcon variant={variant} />
      </span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? "mt-0.5 opacity-90" : "")}>{children}</div>}
      </div>
    </div>
  );
};
