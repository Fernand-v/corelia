"use client";

import { useState } from "react";
import { Button } from "@corelia/ui";

type ProjectDetailFormProps = {
  initial?: { description: string; estimatedBudget: number };
  onSubmit: (data: { description: string; estimatedBudget: number }) => void;
  onCancel: () => void;
  isPending: boolean;
};

export const ProjectDetailForm = ({ initial, onSubmit, onCancel, isPending }: ProjectDetailFormProps) => {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [estimatedBudget, setEstimatedBudget] = useState(String(initial?.estimatedBudget ?? ""));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const budget = Number.parseFloat(estimatedBudget);
        if (!description.trim() || Number.isNaN(budget) || budget < 0) return;
        onSubmit({ description: description.trim(), estimatedBudget: budget });
      }}
    >
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-mid">Descripcion</span>
        <input
          className="h-10 w-full rounded-xl border border-line px-3 text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Infraestructura cloud"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-mid">Presupuesto estimado</span>
        <input
          type="number"
          min="0"
          step="0.01"
          className="h-10 w-full rounded-xl border border-line px-3 text-sm"
          value={estimatedBudget}
          onChange={(e) => setEstimatedBudget(e.target.value)}
          placeholder="0.00"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : initial ? "Actualizar" : "Crear partida"}
        </Button>
      </div>
    </form>
  );
};
