import type { PropsWithChildren } from "react";
import { cn } from "./utils.js";

export interface CardProps extends PropsWithChildren {
  className?: string;
}

export const Card = ({ children, className }: CardProps) => {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      {children}
    </section>
  );
};
