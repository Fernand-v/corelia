import type { PropsWithChildren } from "react";
import { cn } from "./utils.js";

export interface CardProps extends PropsWithChildren {
  className?: string;
}

// Swiss: superficie blanca delimitada por hairline 1px. Sin sombra, blur ni radio.
export const Card = ({ children, className }: CardProps) => {
  return (
    <section className={cn("border border-line bg-paper p-5", className)}>
      {children}
    </section>
  );
};
