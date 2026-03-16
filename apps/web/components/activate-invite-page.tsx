"use client";

import React, { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { activateInviteInputSchema, type AuthToken } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { apiRequest, useAuthStore } from "@/lib/api";
import { useFrontendSettings } from "@/lib/frontend-settings";

const activateInviteFormSchema = activateInviteInputSchema
  .pick({
    firstName: true,
    lastName: true,
    password: true
  })
  .extend({
    confirmPassword: z.string().min(8).max(128)
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"]
  });

type ActivateInviteForm = z.infer<typeof activateInviteFormSchema>;

export const ActivateInvitePage = () => {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const setTokens = useAuthStore((state) => state.setTokens);
  const { settings: frontendSettings } = useFrontendSettings();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ActivateInviteForm>({
    resolver: zodResolver(activateInviteFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: ""
    }
  });

  const activateMutation = useMutation({
    mutationFn: (payload: ActivateInviteForm) =>
      apiRequest<AuthToken>("/auth/activate-invite", {
        method: "POST",
        body: JSON.stringify({
          token,
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          password: payload.password
        })
      }),
    onSuccess: (tokens) => {
      setTokens(tokens.accessToken, tokens.refreshToken);
      router.push("/home" as Route);
    }
  });

  const watchedFirstName = form.watch("firstName");
  const watchedLastName = form.watch("lastName");
  const watchedPassword = form.watch("password");
  const watchedConfirmPassword = form.watch("confirmPassword");

  useEffect(() => {
    if (activateMutation.error) {
      activateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedFirstName, watchedLastName, watchedPassword, watchedConfirmPassword]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Activar cuenta</h1>
          <p className="text-sm text-slate-600">
            Completa tus datos para activar tu invitación interna en {frontendSettings.organizationName}.
          </p>
        </header>

        {!token ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            No se encontró token de invitación en la URL. Solicita un nuevo enlace al administrador.
          </p>
        ) : null}

        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((payload) => {
            if (!token) {
              return;
            }
            activateMutation.mutate(payload);
          })}
        >
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Nombre</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Nombre"
              autoComplete="given-name"
              disabled={!token || activateMutation.isPending}
              {...form.register("firstName")}
            />
            {form.formState.errors.firstName ? (
              <span className="text-xs text-red-500">{form.formState.errors.firstName.message}</span>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Apellido</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Apellido"
              autoComplete="family-name"
              disabled={!token || activateMutation.isPending}
              {...form.register("lastName")}
            />
            {form.formState.errors.lastName ? (
              <span className="text-xs text-red-500">{form.formState.errors.lastName.message}</span>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Contraseña</span>
            <div className="flex items-center gap-2">
              <input
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña"
                autoComplete="new-password"
                disabled={!token || activateMutation.isPending}
                {...form.register("password")}
              />
              <Button
                type="button"
                variant="secondary"
                className="h-10 shrink-0 px-3 text-xs"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                disabled={!token || activateMutation.isPending}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Ocultar" : "Ver"}
              </Button>
            </div>
            {form.formState.errors.password ? (
              <span className="text-xs text-red-500">{form.formState.errors.password.message}</span>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Confirmar contraseña</span>
            <div className="flex items-center gap-2">
              <input
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirmar contraseña"
                autoComplete="new-password"
                disabled={!token || activateMutation.isPending}
                {...form.register("confirmPassword")}
              />
              <Button
                type="button"
                variant="secondary"
                className="h-10 shrink-0 px-3 text-xs"
                aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                title={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                disabled={!token || activateMutation.isPending}
                onClick={() => setShowConfirmPassword((current) => !current)}
              >
                {showConfirmPassword ? "Ocultar" : "Ver"}
              </Button>
            </div>
            {form.formState.errors.confirmPassword ? (
              <span className="text-xs text-red-500">{form.formState.errors.confirmPassword.message}</span>
            ) : null}
          </label>

          {activateMutation.error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {activateMutation.error.message}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={!token || activateMutation.isPending}
          >
            {activateMutation.isPending ? "Activando..." : "Activar cuenta"}
          </Button>
        </form>
      </Card>
    </main>
  );
};
