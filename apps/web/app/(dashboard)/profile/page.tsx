"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import type { Route } from "next";
import { UiModal } from "@/components/ui-modal";
import { apiRequest } from "@/lib/api";
import { useSession, useSessionMembershipSummary } from "@/lib/session";

export default function ProfilePage() {
  const session = useSession();
  const membershipSummary = useSessionMembershipSummary();
  const presenceQuery = useQuery({
    queryKey: ["identity", "presence", session.data?.id],
    queryFn: () =>
      apiRequest<{ items: Array<{ userId: string; status: "EN_LINEA" | "DESCONECTADO" | "EN_REUNION" }> }>(
        `/identity/presence?userIds=${encodeURIComponent(session.data!.id)}`
      ),
    enabled: Boolean(session.data?.id),
    refetchInterval: 15000
  });

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ userId: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordModalOpen(false);
      setPasswordFeedback("Contraseña actualizada correctamente.");
    }
  });

  const presenceStatus =
    presenceQuery.data?.items.find((item) => item.userId === session.data?.id)?.status ?? "DESCONECTADO";
  const presenceTone =
    presenceStatus === "EN_REUNION"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : presenceStatus === "EN_LINEA"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  const presenceLabel =
    presenceStatus === "EN_REUNION"
      ? "En reunión"
      : presenceStatus === "EN_LINEA"
        ? "En línea"
        : "Desconectado";

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 8) {
      setPasswordFeedback("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordFeedback("La nueva contraseña debe ser distinta de la actual.");
      return;
    }

    changePasswordMutation.mutate();
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <h1 className="sr-only">Perfil</h1>

      {passwordFeedback ? (
        <Card className="border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-800">{passwordFeedback}</p>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cuenta</p>
            <Button
              type="button"
              className="h-9 px-3 text-xs"
              onClick={() => {
                setPasswordFeedback(null);
                setPasswordModalOpen(true);
              }}
            >
              Cambiar contraseña
            </Button>
          </div>

          {session.isLoading ? <p className="text-sm text-slate-600">Cargando perfil...</p> : null}
          {session.error ? <p className="text-sm text-red-600">{session.error.message}</p> : null}
          {session.data ? (
            <div className="grid gap-2 text-sm text-slate-900 sm:grid-cols-2">
              <p>
                <span className="font-medium">Nombre:</span> {session.data.firstName} {session.data.lastName}
              </p>
              <p>
                <span className="font-medium">Email:</span> {session.data.email}
              </p>
              <p>
                <span className="font-medium">Rol base:</span> {session.data.baseRole}
              </p>
              <p>
                <span className="font-medium">Rol activo:</span> {session.data.activeRole}
              </p>
              <p>
                <span className="font-medium">Estado:</span>{" "}
                <span className={`inline-flex rounded-lg border px-2 py-0.5 text-xs ${presenceTone}`}>
                  {presenceLabel}
                </span>
              </p>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen</p>
          {membershipSummary.isLoading ? <p className="text-sm text-slate-600">Cargando resumen...</p> : null}
          {membershipSummary.error ? <p className="text-sm text-red-600">{membershipSummary.error.message}</p> : null}
          {membershipSummary.data ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xl font-semibold text-slate-900">{membershipSummary.data.projects.length}</p>
                <p className="text-xs text-slate-600">Proyectos</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xl font-semibold text-slate-900">{membershipSummary.data.teams.length}</p>
                <p className="text-xs text-slate-600">Equipos</p>
              </div>
            </div>
          ) : null}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipos</p>
          {membershipSummary.isLoading ? <p className="text-sm text-slate-600">Cargando equipos...</p> : null}
          {membershipSummary.data && membershipSummary.data.teams.length === 0 ? (
            <p className="text-sm text-slate-600">No tienes equipos asignados.</p>
          ) : null}
          {membershipSummary.data?.teams.length ? (
            <ul className="space-y-2">
              {membershipSummary.data.teams.map((team) => (
                <li key={team.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-900">{team.name}</p>
                  <p className="text-xs text-slate-600">{team.description || "Sin descripción"}</p>
                  <p className="text-[11px] text-slate-500">
                    Desde: {new Date(team.joinedAt).toLocaleDateString("es-ES")}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyectos</p>
            <Link href={"/projects" as Route} className="text-xs text-blue-700 hover:underline">
              Ver todos
            </Link>
          </div>

          {membershipSummary.isLoading ? <p className="text-sm text-slate-600">Cargando proyectos...</p> : null}
          {membershipSummary.data && membershipSummary.data.projects.length === 0 ? (
            <p className="text-sm text-slate-600">No tienes proyectos asignados.</p>
          ) : null}
          {membershipSummary.data?.projects.length ? (
            <ul className="space-y-2">
              {membershipSummary.data.projects.map((project) => (
                <li key={project.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-900">{project.name}</p>
                  <p className="text-xs text-slate-600">
                    {project.template} · {project.isOwner ? "Owner" : project.role ?? "Miembro"}
                  </p>
                  {project.joinedAt ? (
                    <p className="text-[11px] text-slate-500">
                      Desde: {new Date(project.joinedAt).toLocaleDateString("es-ES")}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500">Participación desde creación del proyecto</p>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </section>

      <UiModal
        open={passwordModalOpen}
        onClose={() => {
          if (!changePasswordMutation.isPending) {
            setPasswordModalOpen(false);
          }
        }}
        title="Cambiar contraseña"
      >
        <form id="change-password-form" className="space-y-3" onSubmit={handlePasswordSubmit}>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Contraseña actual</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              type={showPasswords ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Nueva contraseña</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Confirmar nueva contraseña</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>

          <Button
            type="button"
            variant="secondary"
            className="h-9 px-3 text-xs"
            onClick={() => setShowPasswords((current) => !current)}
          >
            {showPasswords ? "Ocultar contraseñas" : "Ver contraseñas"}
          </Button>

          {changePasswordMutation.error ? (
            <p className="text-sm text-red-600">{changePasswordMutation.error.message}</p>
          ) : null}
        </form>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPasswordModalOpen(false)}
            disabled={changePasswordMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="change-password-form"
            disabled={
              changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword
            }
          >
            {changePasswordMutation.isPending ? "Guardando..." : "Actualizar contraseña"}
          </Button>
        </div>
      </UiModal>
    </main>
  );
}
