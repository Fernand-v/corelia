import Link from "next/link";
import type { Route } from "next";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-3xl border border-white/60 bg-white/70 p-8 shadow-panel backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-900">Corelia</h1>
        <p className="mt-2 text-sm text-slate-600">Intranet colaborativa empresarial</p>

        <div className="mt-6 flex gap-3">
          <Link
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
            href="/login"
          >
            Iniciar sesión
          </Link>
          <Link
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            href="/tasks"
          >
            Ver tareas
          </Link>
          <Link
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            href={"/meetings" as Route}
          >
            Reuniones
          </Link>
        </div>
      </section>
    </main>
  );
}
