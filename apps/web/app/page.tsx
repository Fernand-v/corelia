"use client";

import Link from "next/link";
import type { Route } from "next";
import { useFrontendSettings } from "@/lib/frontend-settings";

export default function HomePage() {
  const { settings: frontendSettings } = useFrontendSettings();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-3xl border border-line bg-paper p-8">
        <h1 className="text-3xl font-semibold text-ink">{frontendSettings.organizationName}</h1>
        <p className="mt-2 text-sm text-mid">Intranet colaborativa empresarial</p>

        <div className="mt-6 flex gap-3">
          <Link
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
            href="/login"
          >
            Iniciar sesión
          </Link>
          <Link
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink"
            href="/tasks"
          >
            Ver tareas
          </Link>
          <Link
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink"
            href={"/meetings" as Route}
          >
            Reuniones
          </Link>
        </div>
      </section>
    </main>
  );
}
