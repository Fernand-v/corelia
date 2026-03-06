"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { loginInputSchema, type AuthToken } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { apiRequest, useAuthStore } from "@/lib/api";
import { useFrontendSettings } from "@/lib/frontend-settings";

type LoginInput = {
  email: string;
  password: string;
};

export const LoginForm = () => {
  const router = useRouter();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const { settings: frontendSettings } = useFrontendSettings();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const loginMutation = useMutation({
    mutationFn: (payload: LoginInput) =>
      apiRequest<AuthToken>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      router.push("/home" as Route);
    }
  });

  return (
    <Card className="mx-auto w-full max-w-sm space-y-5 p-7 shadow-dropdown">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h1>
        <p className="text-sm text-slate-500">
          Accede a {frontendSettings.organizationName} con tu cuenta corporativa
        </p>
      </header>

      <form
        className="space-y-3"
        onSubmit={form.handleSubmit((payload) => {
          loginMutation.mutate(payload);
        })}
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</span>
          <input
            className="h-10 w-full rounded-xl border border-[rgba(0,0,0,0.1)] bg-white/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm backdrop-blur-sm transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring"
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <span className="text-xs text-red-500">{form.formState.errors.email.message}</span>
          ) : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Contraseña</span>
          <div className="flex items-center gap-2">
            <input
              className="h-10 w-full rounded-xl border border-[rgba(0,0,0,0.1)] bg-white/70 px-3 text-sm text-slate-900 shadow-sm backdrop-blur-sm transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...form.register("password")}
            />
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-10 shrink-0 p-0"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.58 10.58a2 2 0 002.83 2.83m3.23 3.24A10.94 10.94 0 0112 18C6 18 2.2 12.9 2.03 12.66a1 1 0 010-1.32A18.8 18.8 0 016.1 7.43m3.9-1.56A10.93 10.93 0 0112 6c6 0 9.8 5.1 9.97 5.34a1 1 0 010 1.32 19.37 19.37 0 01-2.63 2.99"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.03 12.66a1 1 0 010-1.32C2.2 11.1 6 6 12 6s9.8 5.1 9.97 5.34a1 1 0 010 1.32C21.8 12.9 18 18 12 18S2.2 12.9 2.03 12.66z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </Button>
          </div>
          {form.formState.errors.password ? (
            <span className="text-xs text-red-500">{form.formState.errors.password.message}</span>
          ) : null}
        </label>

        {loginMutation.error ? (
          <p className="rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-600">
            {loginMutation.error.message}
          </p>
        ) : null}

        <Button className="mt-1 w-full" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </Card>
  );
};
