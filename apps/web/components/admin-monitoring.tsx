"use client";

import { useState } from "react";

type DashboardTab = {
  id: string;
  label: string;
  uid: string;
};

const DASHBOARDS: DashboardTab[] = [
  { id: "overview", label: "Vista General", uid: "corelia-overview" },
  { id: "api", label: "Rendimiento API", uid: "corelia-api-performance" },
  { id: "infra", label: "Infraestructura", uid: "corelia-infrastructure" }
];

const GRAFANA_BASE = "/grafana";

export const AdminMonitoringView = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [iframeError, setIframeError] = useState(false);

  const defaultDashboard = DASHBOARDS[0];
  if (!defaultDashboard) {
    return null;
  }

  const activeDashboard = DASHBOARDS.find((d) => d.id === activeTab) ?? defaultDashboard;
  const iframeSrc = `${GRAFANA_BASE}/d/${activeDashboard.uid}/?orgId=1&theme=light&kiosk`;
  const grafanaFullUrl = `${GRAFANA_BASE}/d/${activeDashboard.uid}/`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Monitoreo del Sistema</h1>
          <p className="mt-1 text-sm text-mid">
            Metricas en tiempo real del backend, base de datos y servicios de infraestructura.
          </p>
        </div>
        <a
          href={grafanaFullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[rgba(0,0,0,0.09)] bg-paper px-3 text-sm font-medium text-ink shadow-sm hover:bg-paper transition-colors duration-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Abrir en Grafana
        </a>
      </div>

      <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-paper backdrop-blur-sm shadow-sm">
        <div className="flex gap-1 border-b border-[rgba(0,0,0,0.07)] px-4 pt-3">
          {DASHBOARDS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setIframeError(false);
              }}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors duration-100 ${
                activeTab === tab.id
                  ? "border-b-2 border-line text-ink bg-paper"
                  : "text-mid hover:text-ink hover:bg-paper"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {iframeError ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="mb-4 rounded-full bg-paper p-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-ink" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-ink">Grafana no disponible</h3>
            <p className="mt-2 max-w-md text-sm text-mid">
              Asegurate de que los servicios de monitoreo esten ejecutandose.
              Ejecuta{" "}
              <code className="rounded bg-line px-1.5 py-0.5 text-xs">
                docker compose --profile monitoring -f docker/docker-compose.yml up -d
              </code>
              .
            </p>
            <button
              type="button"
              onClick={() => setIframeError(false)}
              className="mt-4 rounded-xl border border-[rgba(0,0,0,0.09)] bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-line transition-colors duration-100"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <iframe
            key={activeDashboard.uid}
            src={iframeSrc}
            title={`Grafana - ${activeDashboard.label}`}
            className="w-full border-0"
            style={{ height: "calc(100vh - 280px)", minHeight: "600px" }}
            onError={() => setIframeError(true)}
          />
        )}
      </div>
    </div>
  );
};
