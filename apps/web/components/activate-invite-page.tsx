"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import type { AuthToken } from "@corelia/types";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { apiRequest, useAuthStore } from "@/lib/api";

export const ActivateInvitePage = () => {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");

  const activateMutation = useMutation({
    mutationFn: () =>
      apiRequest<AuthToken>("/auth/activate-invite", {
        method: "POST",
        body: JSON.stringify({
          token,
          firstName,
          lastName,
          password
        })
      }),
    onSuccess: (tokens) => {
      setAccessToken(tokens.accessToken);
      router.push("/home" as Route);
    }
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Activar cuenta</h1>
          <p className="text-sm text-slate-600">
            Completa tus datos para activar tu invitación interna en Corelia.
          </p>
        </header>

        {!token ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            No se encontró token de invitación en la URL.
          </p>
        ) : null}

        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Nombre"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <input
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Apellido"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
          <input
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={!token || !firstName || !lastName || password.length < 8 || activateMutation.isPending}
          onClick={() => activateMutation.mutate()}
        >
          {activateMutation.isPending ? "Activando..." : "Activar cuenta"}
        </Button>

        {activateMutation.error ? (
          <p className="text-sm text-red-600">{activateMutation.error.message}</p>
        ) : null}
      </Card>
    </main>
  );
};
