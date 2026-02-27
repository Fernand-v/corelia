"use client";

import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function ProfilePage() {
  const session = useSession();
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
      setPasswordFeedback("Contraseña actualizada correctamente.");
    }
  });

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
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Perfil personal</h1>
        <p className="text-sm text-slate-600">
          Datos de cuenta, preferencias y configuración personal.
        </p>
      </header>

      <Card className="space-y-2">
        {session.isLoading ? <p className="text-sm text-slate-600">Cargando perfil...</p> : null}
        {session.error ? <p className="text-sm text-red-600">{session.error.message}</p> : null}
        {session.data ? (
          <>
            <p className="text-sm text-slate-900">
              <span className="font-medium">Nombre:</span> {session.data.firstName}{" "}
              {session.data.lastName}
            </p>
            <p className="text-sm text-slate-900">
              <span className="font-medium">Email:</span> {session.data.email}
            </p>
            <p className="text-sm text-slate-900">
              <span className="font-medium">Rol base:</span> {session.data.baseRole}
            </p>
            <p className="text-sm text-slate-900">
              <span className="font-medium">Rol activo:</span> {session.data.activeRole}
            </p>
          </>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Cambiar contraseña</h2>
        <form className="space-y-3" onSubmit={handlePasswordSubmit}>
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

          {passwordFeedback ? <p className="text-sm text-slate-700">{passwordFeedback}</p> : null}
          {changePasswordMutation.error ? (
            <p className="text-sm text-red-600">{changePasswordMutation.error.message}</p>
          ) : null}

          <Button
            type="submit"
            disabled={
              changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword
            }
          >
            {changePasswordMutation.isPending ? "Guardando..." : "Actualizar contraseña"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
