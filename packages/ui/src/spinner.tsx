import * as React from "react";
import { cn } from "./utils.js";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

const sizeStyles: Record<SpinnerSize, string> = {
  xs: "h-3 w-3 border-[1.5px]",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]"
};

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
}

export const Spinner = ({ className, size = "md", ...props }: SpinnerProps) => {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block animate-spin rounded-full border-current border-r-transparent",
        sizeStyles[size],
        className
      )}
      {...props}
    />
  );
};
