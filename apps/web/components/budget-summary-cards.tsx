"use client";

import { Card } from "@corelia/ui";

type BudgetSummaryData = {
  totalEstimated: number;
  totalApproved: number;
  totalPending: number;
  totalRemaining: number;
  executionPct: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);

const formatPct = (value: number) =>
  `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value)}%`;

export const BudgetSummaryCards = ({ data }: { data: BudgetSummaryData }) => {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Card className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-mid">Presupuesto estimado</p>
        <p className="text-lg font-semibold text-ink">{formatCurrency(data.totalEstimated)}</p>
      </Card>
      <Card className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-mid">Gastado aprobado</p>
        <p className="text-lg font-semibold text-ink">{formatCurrency(data.totalApproved)}</p>
      </Card>
      <Card className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-mid">Pendiente de aprobacion</p>
        <p className="text-lg font-semibold text-ink">{formatCurrency(data.totalPending)}</p>
      </Card>
      <Card className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-mid">Restante</p>
        <p className={`text-lg font-semibold ${data.totalRemaining >= 0 ? "text-ink" : "text-urgent"}`}>
          {formatCurrency(data.totalRemaining)}
        </p>
        <p className="text-xs text-mid">Ejecucion: {formatPct(data.executionPct)}</p>
      </Card>
    </div>
  );
};
