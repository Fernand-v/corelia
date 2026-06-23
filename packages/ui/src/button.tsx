import * as React from "react";
import { cn } from "./utils.js";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

// Swiss: primaria en tinta (negro), secundaria hairline, danger en rojo de urgencia.
// Sin sombras ni scale; transición de color sobria.
const styles: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-accent-hover",
  secondary: "bg-paper text-ink border border-line hover:bg-accent-muted",
  ghost: "bg-transparent text-mid hover:bg-accent-muted hover:text-ink",
  danger: "bg-urgent text-white hover:opacity-90"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        styles[variant],
        className
      )}
      {...props}
    />
  );
});
