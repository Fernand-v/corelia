import type { PropsWithChildren } from "react";
import { cn } from "./utils.js";

export interface CardProps extends PropsWithChildren {
  className?: string;
}

export const Card = ({ children, className }: CardProps) => {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-white/80 p-4 shadow-card backdrop-blur-sm",
        "border-[rgba(0,0,0,0.07)]",
        className
      )}
    >
      {children}
    </section>
  );
};
