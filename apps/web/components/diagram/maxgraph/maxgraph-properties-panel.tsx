import { useState } from "react";

import type { DiagramKind } from "@corelia/types";

type SelectedCellType = "none" | "vertex" | "edge";

export type SelectedCellView = {
  type: SelectedCellType;
  id: string | null;
  label: string;
  style: Record<string, unknown>;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  connections: Array<{
    id: string;
    label: string;
    direction: "in" | "out" | "both";
  }>;
  diagramInfo?: {
    totalCells: number;
    totalVertices: number;
    totalEdges: number;
    pageName: string;
  };
  metadata: Array<{ key: string; value: string }>;
};

const fieldClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-400";

const textareaClass =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400";

const sectionClass = "space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2";
const titleClass = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const diagramBadgeColor: Record<DiagramKind, string> = {
  FLUJO: "#4f6ef7",
  SECUENCIA: "#8b5cf6",
  UML_CLASES: "#10b981",
  ENTIDAD_RELACION: "#f97316",
  ESTADO: "#06b6d4",
  ARQUITECTURA: "#1e3a5f",
  BPMN: "#2563eb"
};

export const MaxGraphPropertiesPanel = ({
  diagramKind,
  side = "right",
  readOnly,
  selected,
  onLabelChange,
  onStylePatch,
  onReplaceStyle,
  onGeometryPatch,
  onCenter,
  onHighlightConnection,
  onDeleteConnection,
  onAddMetadata,
  onUpdateMetadata,
  onRemoveMetadata,
  onOpenStyleEditor
}: {
  diagramKind: DiagramKind;
  side?: "left" | "right";
  readOnly: boolean;
  selected: SelectedCellView;
  onLabelChange: (value: string) => void;
  onStylePatch: (patch: Record<string, string | number | boolean>) => void;
  onReplaceStyle: (style: Record<string, string>) => void;
  onGeometryPatch: (patch: Partial<{ x: number; y: number; width: number; height: number }>) => void;
  onCenter: () => void;
  onHighlightConnection: (connectionId: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  onAddMetadata: () => void;
  onUpdateMetadata: (index: number, patch: Partial<{ key: string; value: string }>) => void;
  onRemoveMetadata: (index: number) => void;
  onOpenStyleEditor: () => void;
}) => {
  const [lockRatio, setLockRatio] = useState(true);

  const fillColor = String(selected.style.fillColor ?? "#ffffff");
  const borderColor = String(selected.style.strokeColor ?? "#64748b");
  const borderWidth = Number(selected.style.strokeWidth ?? 1);
  const opacity = Number(selected.style.opacity ?? 100);
  const rounded = Number(selected.style.arcSize ?? (selected.style.rounded ? 16 : 0));
  const shadow = Boolean(selected.style.shadow);
  const textColor = String(selected.style.fontColor ?? "#0f172a");
  const fontFamily = String(selected.style.fontFamily ?? "DM Sans");
  const fontSize = Number(selected.style.fontSize ?? 13);
  const styleType = String(selected.style.edgeStyle ?? "orthogonalEdgeStyle");

  return (
    <aside
      className={`flex h-full min-h-[560px] w-full flex-col overflow-hidden ${
        side === "left" ? "border-r" : "border-l"
      } border-[#e2e8f2] bg-white xl:w-[280px]`}
    >
      <header className="border-b border-[#e2e8f2] p-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Propiedades</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
            {selected.type === "none" ? "Diagrama" : selected.type === "vertex" ? "Nodo" : "Conector"}
          </p>
          <span
            className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: diagramBadgeColor[diagramKind] }}
          >
            {diagramKind}
          </span>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {selected.type === "none" ? (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Selecciona un nodo o un conector para editar sus propiedades.
          </p>
        ) : (
          <>
            <section className={sectionClass}>
              <p className={titleClass}>Contenido</p>
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Label</span>
                <input
                  value={selected.label}
                  onChange={(event) => onLabelChange(event.target.value)}
                  disabled={readOnly}
                  className={fieldClass}
                />
              </label>
            </section>

            <section className={sectionClass}>
              <div className="flex items-center justify-between">
                <p className={titleClass}>Estilo</p>
                <button
                  type="button"
                  onClick={onOpenStyleEditor}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                >
                  Editor avanzado
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Fondo</span>
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(event) => onStylePatch({ fillColor: event.target.value })}
                    disabled={readOnly}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white p-1"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Borde</span>
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(event) => onStylePatch({ strokeColor: event.target.value })}
                    disabled={readOnly}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white p-1"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Grosor borde</span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={borderWidth}
                  onChange={(event) => onStylePatch({ strokeWidth: Number(event.target.value) })}
                  disabled={readOnly}
                  className="w-full"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Opacidad</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={opacity}
                  onChange={(event) => onStylePatch({ opacity: Number(event.target.value) })}
                  disabled={readOnly}
                  className="w-full"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Border radius</span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={rounded}
                  onChange={(event) =>
                    onStylePatch({ rounded: Number(event.target.value) > 0 ? 1 : 0, arcSize: Number(event.target.value) })
                  }
                  disabled={readOnly}
                  className="w-full"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={shadow}
                  onChange={(event) => onStylePatch({ shadow: event.target.checked ? 1 : 0 })}
                  disabled={readOnly}
                />
                Sombra
              </label>

              {selected.type === "edge" ? (
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Tipo de conector</span>
                  <select
                    value={styleType}
                    onChange={(event) => onStylePatch({ edgeStyle: event.target.value })}
                    disabled={readOnly}
                    className={fieldClass}
                  >
                    <option value="orthogonalEdgeStyle">Ortogonal</option>
                    <option value="elbowEdgeStyle">Elbow</option>
                    <option value="segmentEdgeStyle">Segmentado</option>
                    <option value="none">Directo</option>
                  </select>
                </label>
              ) : null}
            </section>

            <section className={sectionClass}>
              <p className={titleClass}>Texto</p>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Fuente</span>
                  <select
                    value={fontFamily}
                    onChange={(event) => onStylePatch({ fontFamily: event.target.value })}
                    disabled={readOnly}
                    className={fieldClass}
                  >
                    <option value="DM Sans">DM Sans</option>
                    <option value="Sora">Sora</option>
                    <option value="monospace">Monospace</option>
                    <option value="serif">Serif</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Tamaño</span>
                  <input
                    type="number"
                    min={8}
                    max={72}
                    value={fontSize}
                    onChange={(event) => onStylePatch({ fontSize: Number(event.target.value) })}
                    disabled={readOnly}
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Color texto</span>
                <input
                  type="color"
                  value={textColor}
                  onChange={(event) => onStylePatch({ fontColor: event.target.value })}
                  disabled={readOnly}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white p-1"
                />
              </label>

              <div className="flex gap-1">
                <button
                  type="button"
                  className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => onStylePatch({ fontStyle: 1 })}
                  disabled={readOnly}
                >
                  B
                </button>
                <button
                  type="button"
                  className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => onStylePatch({ fontStyle: 2 })}
                  disabled={readOnly}
                >
                  I
                </button>
                <button
                  type="button"
                  className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => onStylePatch({ fontStyle: 4 })}
                  disabled={readOnly}
                >
                  U
                </button>
              </div>
            </section>

            <section className={sectionClass}>
              <p className={titleClass}>Geometría</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">X</span>
                  <input
                    type="number"
                    value={Math.round(selected.geometry?.x ?? 0)}
                    onChange={(event) => onGeometryPatch({ x: Number(event.target.value) })}
                    disabled={readOnly || !selected.geometry}
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Y</span>
                  <input
                    type="number"
                    value={Math.round(selected.geometry?.y ?? 0)}
                    onChange={(event) => onGeometryPatch({ y: Number(event.target.value) })}
                    disabled={readOnly || !selected.geometry}
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Ancho</span>
                  <input
                    type="number"
                    value={Math.round(selected.geometry?.width ?? 0)}
                    onChange={(event) => {
                      const width = Number(event.target.value);
                      if (!selected.geometry) {
                        return;
                      }
                      if (lockRatio) {
                        const ratio = selected.geometry.height / Math.max(1, selected.geometry.width);
                        onGeometryPatch({ width, height: Math.round(width * ratio) });
                        return;
                      }
                      onGeometryPatch({ width });
                    }}
                    disabled={readOnly || !selected.geometry}
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Alto</span>
                  <input
                    type="number"
                    value={Math.round(selected.geometry?.height ?? 0)}
                    onChange={(event) => {
                      const height = Number(event.target.value);
                      if (!selected.geometry) {
                        return;
                      }
                      if (lockRatio) {
                        const ratio = selected.geometry.width / Math.max(1, selected.geometry.height);
                        onGeometryPatch({ height, width: Math.round(height * ratio) });
                        return;
                      }
                      onGeometryPatch({ height });
                    }}
                    disabled={readOnly || !selected.geometry}
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={lockRatio}
                  onChange={(event) => setLockRatio(event.target.checked)}
                />
                Bloquear proporción
              </label>

              <button
                type="button"
                onClick={onCenter}
                disabled={readOnly}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Centrar en pantalla
              </button>
            </section>

            <section className={sectionClass}>
              <p className={titleClass}>Conexiones ({selected.connections.length})</p>
              {selected.connections.length > 0 ? (
                <div className="space-y-2">
                  {selected.connections.map((connection) => (
                    <div key={connection.id} className="rounded border border-slate-200 bg-white p-2">
                      <p className="text-[11px] font-semibold text-slate-700">{connection.label}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">{connection.direction}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => onHighlightConnection(connection.id)}
                          className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700"
                        >
                          Resaltar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteConnection(connection.id)}
                          disabled={readOnly}
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Sin conexiones</p>
              )}
            </section>

            <section className={sectionClass}>
              <p className={titleClass}>Datos Personalizados</p>
              <div className="space-y-2">
                {selected.metadata.map((item, index) => (
                  <div key={`${item.key}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                    <input
                      value={item.key}
                      onChange={(event) => onUpdateMetadata(index, { key: event.target.value })}
                      disabled={readOnly}
                      className={fieldClass}
                      placeholder="key"
                    />
                    <input
                      value={item.value}
                      onChange={(event) => onUpdateMetadata(index, { value: event.target.value })}
                      disabled={readOnly}
                      className={fieldClass}
                      placeholder="value"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveMetadata(index)}
                      disabled={readOnly}
                      className="h-9 rounded border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700"
                    >
                      −
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={onAddMetadata}
                disabled={readOnly}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
              >
                + Añadir propiedad
              </button>
            </section>

            <section className={sectionClass}>
              <p className={titleClass}>Raw style</p>
              <textarea
                rows={4}
                value={Object.entries(selected.style)
                  .map(([key, value]) => `${key}=${String(value)}`)
                  .join("; ")}
                className={textareaClass}
                readOnly
              />
              <button
                type="button"
                onClick={() => onReplaceStyle(Object.fromEntries(Object.entries(selected.style).map(([k, v]) => [k, String(v)])))}
                disabled
                className="hidden"
              >
                hidden
              </button>
            </section>
          </>
        )}
      </div>
    </aside>
  );
};
