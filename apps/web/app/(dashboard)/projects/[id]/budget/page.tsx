"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import { UiModal } from "@/components/ui-modal";
import { BudgetSummaryCards } from "@/components/budget-summary-cards";
import { ProjectDetailForm } from "@/components/project-detail-form";
import { ExpenseForm } from "@/components/expense-form";
import { Checkmark24Regular, Delete24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { BudgetSummary, ExpenseStatus } from "@corelia/types";

type DetailItem = {
  id: string;
  projectId: string;
  description: string;
  estimatedBudget: number;
  approvedExpenses: number;
  pendingExpenses: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

type ExpenseItem = {
  id: string;
  projectDetailId: string;
  detailDescription: string;
  description: string;
  amount: number;
  date: string;
  receiptPath: string | null;
  status: ExpenseStatus;
  approvedByName: string | null;
  approvedAt: string | null;
  createdByName: string;
  createdAt: string;
};

type ExpensesResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: ExpenseItem[];
};

const MANAGE_ROLES = new Set(["ADMINISTRADOR", "LIDER_PROYECTO", "COORDINADOR_EQUIPO"]);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("es-ES", { dateStyle: "medium" });

const statusLabel: Record<ExpenseStatus, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado"
};

const statusColor: Record<ExpenseStatus, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  APROBADO: "bg-green-100 text-green-800",
  RECHAZADO: "bg-red-100 text-red-800"
};

export default function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const queryClient = useQueryClient();
  const session = useSession();

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const canManage = session.data?.activeRole
    ? MANAGE_ROLES.has(session.data.activeRole)
    : false;

  const summaryQuery = useQuery({
    queryKey: ["budget-summary", projectId],
    queryFn: () => apiRequest<BudgetSummary>(`/projects/${projectId}/budget-summary`)
  });

  const detailsQuery = useQuery({
    queryKey: ["budget-details", projectId],
    queryFn: () => apiRequest<DetailItem[]>(`/projects/${projectId}/details`)
  });

  const expensesQuery = useQuery({
    queryKey: ["budget-expenses", projectId, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", "20");
      const qs = params.toString();
      return apiRequest<ExpensesResponse>(`/projects/${projectId}/expenses?${qs}`);
    }
  });

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["budget-summary", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["budget-details", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["budget-expenses", projectId] })
    ]);
  };

  const createDetailMutation = useMutation({
    mutationFn: (data: { description: string; estimatedBudget: number }) =>
      apiRequest(`/projects/${projectId}/details`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: async () => {
      setDetailModalOpen(false);
      setError(null);
      await invalidateAll();
    },
    onError: (err) => setError(err.message)
  });

  const deleteDetailMutation = useMutation({
    mutationFn: (detailId: string) =>
      apiRequest(`/projects/${projectId}/details/${detailId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(),
    onError: (err) => setError(err.message)
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: { projectDetailId: string; description: string; amount: number; date: string }) =>
      apiRequest(`/projects/${projectId}/expenses`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: async () => {
      setExpenseModalOpen(false);
      setError(null);
      await invalidateAll();
    },
    onError: (err) => setError(err.message)
  });

  const approveExpenseMutation = useMutation({
    mutationFn: ({ expenseId, status }: { expenseId: string; status: "APROBADO" | "RECHAZADO" }) =>
      apiRequest(`/projects/${projectId}/expenses/${expenseId}/approve`, {
        method: "POST",
        body: JSON.stringify({ status })
      }),
    onSuccess: () => invalidateAll(),
    onError: (err) => setError(err.message)
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) =>
      apiRequest(`/projects/${projectId}/expenses/${expenseId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(),
    onError: (err) => setError(err.message)
  });

  const summary = summaryQuery.data;
  const details = detailsQuery.data ?? [];
  const expenses = expensesQuery.data;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <h1 className="sr-only">Presupuesto del proyecto</h1>

      {error ? (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      ) : null}

      {summaryQuery.isLoading ? (
        <Card><p className="text-sm text-slate-600">Cargando resumen...</p></Card>
      ) : summary ? (
        <BudgetSummaryCards data={summary} />
      ) : null}

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partidas presupuestarias</p>
          {canManage ? (
            <Button type="button" className="h-9 px-3 text-xs" onClick={() => { setError(null); setDetailModalOpen(true); }}>
              Nueva partida
            </Button>
          ) : null}
        </div>

        {detailsQuery.isLoading ? (
          <p className="text-sm text-slate-600">Cargando partidas...</p>
        ) : details.length === 0 ? (
          <p className="text-sm text-slate-600">No hay partidas presupuestarias.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Descripcion</th>
                  <th className="px-2 py-2">Estimado</th>
                  <th className="px-2 py-2">Aprobado</th>
                  <th className="px-2 py-2">Pendiente</th>
                  <th className="px-2 py-2">Progreso</th>
                  {canManage ? <th className="px-2 py-2">Acciones</th> : null}
                </tr>
              </thead>
              <tbody>
                {details.map((detail) => {
                  const pct = detail.estimatedBudget > 0
                    ? Math.min(100, Math.round((detail.approvedExpenses / detail.estimatedBudget) * 100))
                    : 0;
                  return (
                    <tr key={detail.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 font-medium text-slate-800">{detail.description}</td>
                      <td className="px-2 py-2 text-slate-700">{formatCurrency(detail.estimatedBudget)}</td>
                      <td className="px-2 py-2 text-green-700">{formatCurrency(detail.approvedExpenses)}</td>
                      <td className="px-2 py-2 text-amber-600">{formatCurrency(detail.pendingExpenses)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-slate-200">
                            <div className="h-2 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-600">{pct}%</span>
                        </div>
                      </td>
                      {canManage ? (
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="inline-flex h-7 items-center gap-1 border border-slate-200 bg-slate-100 px-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
                            onClick={() => deleteDetailMutation.mutate(detail.id)}
                            disabled={deleteDetailMutation.isPending}
                          >
                            <Delete24Regular className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gastos</p>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-xl border border-slate-300 px-3 text-xs"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as ExpenseStatus | ""); setPage(1); }}
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="APROBADO">Aprobado</option>
              <option value="RECHAZADO">Rechazado</option>
            </select>
            {canManage && details.length > 0 ? (
              <Button type="button" className="h-9 px-3 text-xs" onClick={() => { setError(null); setExpenseModalOpen(true); }}>
                Nuevo gasto
              </Button>
            ) : null}
          </div>
        </div>

        {expensesQuery.isLoading ? (
          <p className="text-sm text-slate-600">Cargando gastos...</p>
        ) : !expenses || expenses.items.length === 0 ? (
          <p className="text-sm text-slate-600">No hay gastos registrados.</p>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Partida</th>
                    <th className="px-2 py-2">Descripcion</th>
                    <th className="px-2 py-2">Monto</th>
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Aprobado/Rechazado por</th>
                    <th className="px-2 py-2">Creado por</th>
                    {canManage ? <th className="px-2 py-2">Acciones</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {expenses.items.map((expense) => (
                    <tr key={expense.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 text-slate-700">{expense.detailDescription}</td>
                      <td className="px-2 py-2 font-medium text-slate-800">{expense.description}</td>
                      <td className="px-2 py-2 text-slate-700">{formatCurrency(expense.amount)}</td>
                      <td className="px-2 py-2 text-slate-700">{formatDate(expense.date)}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[expense.status]}`}>
                          {statusLabel[expense.status]}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {expense.approvedByName ? (
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium text-slate-800">{expense.approvedByName}</p>
                            <p className="text-[11px] text-slate-500">
                              {expense.approvedAt ? formatDate(expense.approvedAt) : "Sin fecha registrada"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Pendiente</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-slate-700">{expense.createdByName}</td>
                      {canManage ? (
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            {expense.status === "PENDIENTE" ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="inline-flex h-7 items-center gap-1 border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700 hover:bg-green-100"
                                  onClick={() => approveExpenseMutation.mutate({ expenseId: expense.id, status: "APROBADO" })}
                                  disabled={approveExpenseMutation.isPending}
                                >
                                  <Checkmark24Regular className="h-3.5 w-3.5" />
                                  <span>Aprobar</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="inline-flex h-7 items-center gap-1 border border-rose-200 bg-rose-50 px-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
                                  onClick={() => approveExpenseMutation.mutate({ expenseId: expense.id, status: "RECHAZADO" })}
                                  disabled={approveExpenseMutation.isPending}
                                >
                                  <Dismiss24Regular className="h-3.5 w-3.5" />
                                  <span>Rechazar</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="inline-flex h-7 items-center gap-1 border border-slate-200 bg-slate-100 px-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                  onClick={() => deleteExpenseMutation.mutate(expense.id)}
                                  disabled={deleteExpenseMutation.isPending}
                                >
                                  <Delete24Regular className="h-3.5 w-3.5" />
                                  <span>Eliminar</span>
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {expenses.total > expenses.pageSize ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{expenses.total} gastos en total</p>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="h-8 px-3 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    disabled={page * expenses.pageSize >= expenses.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <UiModal
        open={detailModalOpen}
        onClose={() => { if (!createDetailMutation.isPending) setDetailModalOpen(false); }}
        title="Nueva partida presupuestaria"
      >
        <ProjectDetailForm
          onSubmit={(data) => createDetailMutation.mutate(data)}
          onCancel={() => setDetailModalOpen(false)}
          isPending={createDetailMutation.isPending}
        />
      </UiModal>

      <UiModal
        open={expenseModalOpen}
        onClose={() => { if (!createExpenseMutation.isPending) setExpenseModalOpen(false); }}
        title="Nuevo gasto"
      >
        <ExpenseForm
          details={details.map((d) => ({ id: d.id, description: d.description }))}
          onSubmit={(data) => createExpenseMutation.mutate(data)}
          onCancel={() => setExpenseModalOpen(false)}
          isPending={createExpenseMutation.isPending}
        />
      </UiModal>
    </main>
  );
}
