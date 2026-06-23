"use client";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Numeral,
  Progress,
  Rule,
  SectionHead,
  Stat
} from "@corelia/ui";

// Styleguide viva del sistema "Swiss editorial". Referencia de las primitivas y
// tokens; sustituye al preview estático. No es una página de producto.
export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-[1080px] space-y-12 px-2 py-6">
      <header className="border-b border-ink pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Sistema de diseño</h1>
        <p className="mt-1 text-sm text-mid">
          Swiss editorial · blanco · tinta + un rojo de urgencia · hairlines · numerales como composición
        </p>
      </header>

      {/* Tipografía y numerales */}
      <section>
        <SectionHead folio="01" title="Tipografía" />
        <div className="space-y-3">
          <p className="text-3xl font-bold tracking-tight text-ink">Archivo · titular</p>
          <p className="text-base text-ink">Cuerpo de texto en Archivo regular sobre blanco puro.</p>
          <p className="text-sm text-mid">Texto secundario en gris medio.</p>
          <p className="text-xs uppercase tracking-widest text-faint">Etiqueta · versalita</p>
          <div className="flex items-baseline gap-6 pt-2">
            <Numeral className="text-6xl">72</Numeral>
            <Numeral className="text-6xl">340</Numeral>
            <Numeral className="text-6xl text-urgent">8</Numeral>
          </div>
        </div>
      </section>

      {/* Paleta */}
      <section>
        <SectionHead folio="02" title="Paleta" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { name: "paper", cls: "bg-paper border border-line" },
            { name: "ink", cls: "bg-ink" },
            { name: "mid", cls: "bg-mid" },
            { name: "faint", cls: "bg-faint" },
            { name: "line", cls: "bg-line" },
            { name: "urgent", cls: "bg-urgent" }
          ].map((c) => (
            <div key={c.name} className="space-y-1">
              <div className={`h-16 w-full ${c.cls}`} />
              <p className="text-[11px] uppercase tracking-wide text-mid">{c.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Botones */}
      <section>
        <SectionHead folio="03" title="Botones" />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Acción primaria</Button>
          <Button variant="secondary">Secundaria</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="danger">Urgente</Button>
          <Button variant="primary" disabled>
            Deshabilitada
          </Button>
        </div>
      </section>

      {/* Badges */}
      <section>
        <SectionHead folio="04" title="Etiquetas" />
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Estándar</Badge>
          <Badge variant="neutral" dot>
            Neutra
          </Badge>
          <Badge variant="warning" dot>
            Riesgo
          </Badge>
          <Badge variant="danger" dot>
            Vencida
          </Badge>
        </div>
      </section>

      {/* Stat */}
      <section>
        <SectionHead folio="05" title="Indicadores" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Proyectos activos" value={12} />
          <Stat label="Tareas activas" value={340} trend="up" trendLabel="+8%" />
          <Stat label="Tareas vencidas" value={8} trend="down" trendLabel="+3" />
          <Stat label="Automatizaciones fallidas 24 h" value={1} description="último día" />
        </div>
      </section>

      {/* Progreso */}
      <section>
        <SectionHead folio="06" title="Progreso" />
        <div className="max-w-md space-y-4">
          <Progress value={72} label="Plataforma intranet" showValue />
          <Progress value={40} variant="danger" label="Portal de clientes" showValue />
        </div>
      </section>

      {/* Card + Rule */}
      <section>
        <SectionHead folio="07" title="Superficie y regla" />
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Tarjeta hairline</p>
          <p className="text-sm text-mid">
            Superficie blanca delimitada por hairline 1px. Sin sombra, blur ni esquinas redondeadas.
          </p>
          <Rule />
          <p className="text-xs text-faint">Pie de tarjeta tras una regla.</p>
        </Card>
      </section>

      {/* Avatares */}
      <section>
        <SectionHead folio="08" title="Avatares" />
        <div className="flex items-center gap-3">
          <Avatar name="Ana Pérez" size="sm" />
          <Avatar name="Bruno Díaz" size="md" />
          <Avatar name="Carla Ruiz" size="lg" />
        </div>
      </section>

      {/* Alertas */}
      <section>
        <SectionHead folio="09" title="Avisos" />
        <div className="space-y-3">
          <Alert variant="info" title="Información">
            Aviso neutro en hairline, sin color de fondo.
          </Alert>
          <Alert variant="danger" title="Atención">
            El rojo de urgencia se reserva para lo que requiere acción.
          </Alert>
        </div>
      </section>

      {/* Empty */}
      <section>
        <SectionHead folio="10" title="Estado vacío" />
        <Card>
          <Empty title="Sin elementos" description="Aún no hay datos para mostrar aquí." />
        </Card>
      </section>
    </div>
  );
}
