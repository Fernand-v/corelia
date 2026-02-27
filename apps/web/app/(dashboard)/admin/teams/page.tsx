import { AdminTeamsView } from "@/components/admin-teams";

export default function AdminTeamsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 md:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Administración de Equipos</h1>
        <p className="text-sm text-slate-600">
          Crear, editar y gestionar miembros de equipos desde la interfaz.
        </p>
      </header>
      <AdminTeamsView />
    </main>
  );
}
