"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@corelia/ui";
import type { Task } from "@corelia/types";

export type ProjectMemberOption = {
  userId: string;
  fullName: string;
  initials: string;
  availability: "DISPONIBLE" | "OCUPADO" | "EN_REUNION" | "AUSENTE";
  overloaded: boolean;
};

type TaskAssigneeSelectorProps = {
  task: Task;
  members: ProjectMemberOption[];
  isPending?: boolean;
  onAssign: (input: {
    taskId: string;
    newAssigneeId: string;
    reason: string;
    reopenIfCompleted: boolean;
  }) => void;
};

const availabilityLabel: Record<ProjectMemberOption["availability"], string> = {
  DISPONIBLE: "Disponible",
  OCUPADO: "Ocupado",
  EN_REUNION: "En reunión",
  AUSENTE: "Ausente"
};

export const TaskAssigneeSelector = ({
  task,
  members,
  isPending = false,
  onAssign
}: TaskAssigneeSelectorProps) => {
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(task.assigneeId ?? "");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setSelectedAssigneeId(task.assigneeId ?? "");
    setReason("");
  }, [task.assigneeId, task.id]);

  const selectedMember = useMemo(
    () => members.find((member) => member.userId === selectedAssigneeId) ?? null,
    [members, selectedAssigneeId]
  );

  const isReassignment =
    Boolean(task.assigneeId) && Boolean(selectedAssigneeId) && selectedAssigneeId !== task.assigneeId;

  const canSubmit =
    Boolean(selectedAssigneeId) &&
    selectedAssigneeId !== task.assigneeId &&
    (!isReassignment || reason.trim().length >= 5);

  return (
    <div className="space-y-2">
      <select
        className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs"
        value={selectedAssigneeId}
        onChange={(event) => setSelectedAssigneeId(event.target.value)}
      >
        <option value="">Seleccionar responsable</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.fullName} · {availabilityLabel[member.availability]}
            {member.overloaded ? " · Alta carga" : ""}
          </option>
        ))}
      </select>

      {isReassignment ? (
        <input
          className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs"
          placeholder="Motivo de reasignación (mín. 5)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {selectedMember ? (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
            {selectedMember.initials} · {availabilityLabel[selectedMember.availability]}
          </span>
        ) : (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            Sin asignar
          </span>
        )}

        <Button
          type="button"
          className="h-8 px-3 text-xs"
          disabled={isPending || !canSubmit}
          onClick={() =>
            onAssign({
              taskId: task.id,
              newAssigneeId: selectedAssigneeId,
              reason: isReassignment ? reason.trim() : "Asignación inicial desde interfaz",
              reopenIfCompleted: false
            })
          }
        >
          {isPending ? "Guardando..." : task.assigneeId ? "Reasignar" : "Asignar"}
        </Button>
      </div>
    </div>
  );
};
