"use client";

import { useState } from "react";
import { EntityCrud, type CrudConfig } from "@/components/entity-crud";
import { useSession } from "@/lib/session";

type TabKey = "personas" | "empresas" | "sucursales" | "paises" | "ciudades" | "sexos";

const TABS: { key: TabKey; label: string }[] = [
  { key: "personas", label: "Personas" },
  { key: "empresas", label: "Empresas" },
  { key: "sucursales", label: "Sucursales" },
  { key: "paises", label: "Países" },
  { key: "ciudades", label: "Ciudades" },
  { key: "sexos", label: "Sexo" }
];

export function RegistrosBoard() {
  const session = useSession();
  const permissions = session.data?.permissions ?? [];
  const canManageCatalogo = permissions.includes("CATALOGO_GESTIONAR");
  const canManagePersona = permissions.includes("PERSONA_GESTIONAR");

  const [tab, setTab] = useState<TabKey>("personas");

  const configs: Record<TabKey, CrudConfig> = {
    sexos: {
      endpoint: "/registros/sexos",
      title: "Sexo",
      canManage: canManageCatalogo,
      rowLabel: (item) => String(item.descripcion ?? item.codigo),
      fields: [
        { name: "codigo", label: "Código (M/F/X)", type: "text", required: true, inTable: true },
        { name: "descripcion", label: "Descripción", type: "text", required: true, inTable: true }
      ]
    },
    paises: {
      endpoint: "/registros/paises",
      title: "Países",
      canManage: canManageCatalogo,
      rowLabel: (item) => String(item.descripcion),
      fields: [
        { name: "codigo", label: "Código", type: "number", required: true, inTable: true },
        { name: "descripcion", label: "Descripción", type: "text", required: true, inTable: true },
        { name: "nacionalidad", label: "Nacionalidad", type: "text", inTable: true }
      ]
    },
    ciudades: {
      endpoint: "/registros/ciudades",
      title: "Ciudades",
      canManage: canManageCatalogo,
      rowLabel: (item) => String(item.descripcion),
      fields: [
        { name: "codigo", label: "Código", type: "number", required: true, inTable: true },
        { name: "descripcion", label: "Descripción", type: "text", required: true, inTable: true },
        {
          name: "paisId",
          label: "País",
          type: "select",
          required: true,
          inTable: true,
          selectSource: { endpoint: "/registros/paises", labelKey: "descripcion" },
          tableRender: (item) =>
            String((item.pais as { descripcion?: string } | null)?.descripcion ?? "—")
        }
      ]
    },
    empresas: {
      endpoint: "/registros/empresas",
      title: "Empresas",
      canManage: canManageCatalogo,
      rowLabel: (item) => String(item.razonSocial),
      fields: [
        { name: "razonSocial", label: "Razón social", type: "text", required: true, inTable: true },
        { name: "nombreFantasia", label: "Nombre fantasía", type: "text" },
        { name: "ruc", label: "RUC", type: "text", inTable: true },
        { name: "dv", label: "DV", type: "text" },
        { name: "direccion", label: "Dirección", type: "text" },
        { name: "telefono", label: "Teléfono", type: "text" },
        { name: "fax", label: "Fax", type: "text" },
        { name: "localidad", label: "Localidad", type: "text", inTable: true },
        { name: "nroInscripcionIps", label: "Nº inscripción IPS", type: "text" },
        { name: "nroInscripcionBnt", label: "Nº inscripción BNT", type: "text" },
        { name: "explotacion", label: "Rubro / Explotación", type: "text" },
        { name: "nombreContador", label: "Contador", type: "text" },
        { name: "rucContador", label: "RUC contador", type: "text" },
        { name: "nombreRepresentante", label: "Representante legal", type: "text" },
        { name: "rucRepresentante", label: "RUC representante", type: "text" },
        { name: "descripcionFactura", label: "Descripción en factura", type: "textarea" },
        { name: "urlReports", label: "URL reportes", type: "text" },
        { name: "logoUrl", label: "URL logo", type: "text" },
        { name: "esExportador", label: "Es exportador", type: "checkbox" },
        { name: "esExterna", label: "Es externa", type: "checkbox" },
        {
          name: "facturadorElectronico",
          label: "Facturador electrónico",
          type: "checkbox",
          inTable: true
        },
        { name: "habilitada", label: "Habilitada", type: "checkbox", inTable: true }
      ]
    },
    sucursales: {
      endpoint: "/registros/sucursales",
      title: "Sucursales",
      canManage: canManageCatalogo,
      rowLabel: (item) => String(item.descripcion),
      fields: [
        {
          name: "empresaId",
          label: "Empresa",
          type: "select",
          required: true,
          inTable: true,
          selectSource: { endpoint: "/registros/empresas", labelKey: "razonSocial" },
          tableRender: (item) =>
            String((item.empresa as { razonSocial?: string } | null)?.razonSocial ?? "—")
        },
        { name: "codigo", label: "Código", type: "number", required: true, inTable: true },
        { name: "descripcion", label: "Descripción", type: "text", required: true, inTable: true },
        { name: "abreviatura", label: "Abreviatura", type: "text" },
        { name: "direccion", label: "Dirección", type: "text" },
        { name: "telefono", label: "Teléfono", type: "text" },
        { name: "fax", label: "Fax", type: "text" },
        { name: "localidad", label: "Localidad", type: "text" },
        { name: "departamento", label: "Departamento", type: "text" },
        { name: "ruc", label: "RUC", type: "text" },
        { name: "logoUrl", label: "URL logo", type: "text" },
        { name: "esCasaCentral", label: "Casa central", type: "checkbox", inTable: true },
        { name: "isActive", label: "Activa", type: "checkbox", inTable: true }
      ]
    },
    personas: {
      endpoint: "/registros/personas",
      title: "Personas",
      canManage: canManagePersona,
      rowLabel: (item) => String(item.razonSocial),
      fields: [
        {
          name: "empresaId",
          label: "Empresa",
          type: "select",
          required: true,
          inTable: true,
          selectSource: { endpoint: "/registros/empresas", labelKey: "razonSocial" },
          tableRender: (item) =>
            String((item.empresa as { razonSocial?: string } | null)?.razonSocial ?? "—")
        },
        { name: "ruc", label: "RUC / Documento", type: "text", required: true, inTable: true },
        { name: "dv", label: "DV", type: "text" },
        { name: "razonSocial", label: "Razón social / Nombre", type: "text", required: true, inTable: true },
        { name: "nombreFantasia", label: "Nombre fantasía", type: "text" },
        { name: "propietario", label: "Propietario", type: "text" },
        { name: "direccion", label: "Dirección", type: "textarea", required: true },
        { name: "localidad", label: "Localidad", type: "text" },
        { name: "barrio", label: "Barrio", type: "text" },
        {
          name: "paisId",
          label: "País",
          type: "select",
          selectSource: { endpoint: "/registros/paises", labelKey: "descripcion" }
        },
        {
          name: "ciudadId",
          label: "Ciudad",
          type: "select",
          selectSource: { endpoint: "/registros/ciudades", labelKey: "descripcion" }
        },
        {
          name: "sexoId",
          label: "Sexo",
          type: "select",
          selectSource: { endpoint: "/registros/sexos", labelKey: "descripcion" }
        },
        { name: "telefono", label: "Teléfono", type: "text", required: true, inTable: true },
        { name: "celular", label: "Celular", type: "text" },
        { name: "email", label: "Email", type: "text" },
        { name: "personaContacto", label: "Persona de contacto", type: "text" },
        { name: "fechaAniversario", label: "Fecha aniversario", type: "date" },
        { name: "esPep", label: "Es PEP", type: "checkbox" },
        { name: "isActive", label: "Activo", type: "checkbox" }
      ]
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Registros</h1>
        <p className="text-sm text-mid">Personas, empresas y catálogos generales</p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-line">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === item.key
                ? "border-ink font-medium text-ink"
                : "border-transparent text-mid hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <EntityCrud config={configs[tab]} />
    </div>
  );
}
