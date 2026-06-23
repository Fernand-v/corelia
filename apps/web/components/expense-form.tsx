"use client";

import { useState } from "react";
import { Button } from "@corelia/ui";

type DetailOption = { id: string; description: string };

type ExpenseFormProps = {
  details: DetailOption[];
  initial?: {
    projectDetailId: string;
    description: string;
    amount: number;
    date: string;
  };
  onSubmit: (data: {
    projectDetailId: string;
    description: string;
    amount: number;
    date: string;
  }) => void;
  onCancel: () => void;
  isPending: boolean;
};

export const ExpenseForm = ({ details, initial, onSubmit, onCancel, isPending }: ExpenseFormProps) => {
  const [projectDetailId, setProjectDetailId] = useState(initial?.projectDetailId ?? (details[0]?.id ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [date, setDate] = useState(initial?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const parsedAmount = Number.parseFloat(amount);
        if (!projectDetailId || !description.trim() || Number.isNaN(parsedAmount) || parsedAmount < 0 || !date) return;
        onSubmit({
          projectDetailId,
          description: description.trim(),
          amount: parsedAmount,
          date: `${date}T00:00:00.000Z`
        });
      }}
    >
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-mid">Partida</span>
        <select
          className="h-10 w-full rounded-xl border border-line px-3 text-sm"
          value={projectDetailId}
          onChange={(e) => setProjectDetailId(e.target.value)}
        >
          {details.map((d) => (
            <option key={d.id} value={d.id}>{d.description}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-mid">Descripcion</span>
        <input
          className="h-10 w-full rounded-xl border border-line px-3 text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Licencia software X"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-mid">Monto</span>
        <input
          type="number"
          min="0"
          step="0.01"
          className="h-10 w-full rounded-xl border border-line px-3 text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-mid">Fecha</span>
        <input
          type="date"
          className="h-10 w-full rounded-xl border border-line px-3 text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : initial ? "Actualizar" : "Registrar gasto"}
        </Button>
      </div>
    </form>
  );
};
