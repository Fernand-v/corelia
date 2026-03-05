import * as React from "react";
import { cn } from "./utils.js";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-sm hover:bg-accent-hover active:scale-[0.97] transition-transform duration-100",
  secondary:
    "bg-white/70 text-slate-800 border border-[rgba(0,0,0,0.09)] shadow-sm backdrop-blur-sm hover:bg-white/90 active:scale-[0.97] transition-transform duration-100",
  ghost:
    "bg-transparent text-slate-700 hover:bg-black/5 active:scale-[0.97] transition-transform duration-100",
  danger:
    "bg-red-500 text-white shadow-sm hover:bg-red-600 active:scale-[0.97] transition-transform duration-100"
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
        "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        styles[variant],
        className
      )}
      {...props}
    />
  );
});
