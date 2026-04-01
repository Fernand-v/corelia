import { AdminAccessView } from "@/components/admin-access";

export default function AdminAccessPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 md:px-6 lg:px-8">
      <h1 className="sr-only">Administración de accesos</h1>
      <AdminAccessView />
    </main>
  );
}
