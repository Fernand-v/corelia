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
        <p className="text-xs uppercase tracking-wide text-slate-500">Presupuesto estimado</p>
        <p className="text-lg font-semibold text-slate-900">{formatCurrency(data.totalEstimated)}</p>
      </Card>
      <Card className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Gastado aprobado</p>
        <p className="text-lg font-semibold text-green-700">{formatCurrency(data.totalApproved)}</p>
      </Card>
      <Card className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Pendiente de aprobacion</p>
        <p className="text-lg font-semibold text-amber-600">{formatCurrency(data.totalPending)}</p>
      </Card>
      <Card className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Restante</p>
        <p className={`text-lg font-semibold ${data.totalRemaining >= 0 ? "text-slate-900" : "text-red-600"}`}>
          {formatCurrency(data.totalRemaining)}
        </p>
        <p className="text-xs text-slate-500">Ejecucion: {formatPct(data.executionPct)}</p>
      </Card>
    </div>
  );
};
