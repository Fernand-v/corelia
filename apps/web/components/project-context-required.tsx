import Link from "next/link";
import type { Route } from "next";
import { Card } from "@corelia/ui";

type ProjectContextRequiredProps = {
  sectionLabel: string;
  description: string;
};

export const ProjectContextRequired = ({ sectionLabel, description }: ProjectContextRequiredProps) => {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">{sectionLabel}</h1>
        <p className="text-sm text-mid">{description}</p>
      </header>
      <Card className="space-y-3">
        <p className="text-sm text-ink">
          Esta sección se habilita dentro de un proyecto activo.
        </p>
        <Link
          href={"/projects" as Route}
          className="inline-flex rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:bg-line"
        >
          Seleccionar proyecto
        </Link>
      </Card>
    </main>
  );
};
