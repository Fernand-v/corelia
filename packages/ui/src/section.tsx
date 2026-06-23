import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "./utils.js";

export interface SectionHeadProps {
  /** Folio de la sección, p. ej. "01". Numeral condensado, marca de composición. */
  folio?: string;
  title: string;
  meta?: ReactNode;
  className?: string;
}

// Swiss: regla de tinta superior + folio condensado + título en versalitas.
export const SectionHead = ({ folio, title, meta, className }: SectionHeadProps) => (
  <div className={cn("mb-4 flex items-baseline gap-4 border-t border-ink pt-2.5", className)}>
    {folio ? (
      <span className="font-condensed text-3xl font-bold leading-none tracking-tight text-ink">
        {folio}
      </span>
    ) : null}
    <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink">{title}</h2>
    {meta ? <span className="ml-auto text-xs text-mid">{meta}</span> : null}
  </div>
);

export interface NumeralProps extends PropsWithChildren {
  className?: string;
}

// Numeral condensado tabular: para %, contadores y cifras como composición.
export const Numeral = ({ children, className }: NumeralProps) => (
  <span className={cn("font-condensed font-bold tabular-nums tracking-tight text-ink", className)}>
    {children}
  </span>
);

export interface RuleProps {
  className?: string;
}

// Hairline 1px. Unidad estructural del sistema (en vez de tarjetas con sombra).
export const Rule = ({ className }: RuleProps) => (
  <hr className={cn("border-0 border-t border-line", className)} />
);
