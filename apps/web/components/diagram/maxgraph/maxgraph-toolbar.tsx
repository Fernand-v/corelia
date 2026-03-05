import type { DiagramKind } from "@corelia/types";

import type { GraphToolbarActions, GraphToolbarState } from "@/components/diagram/maxgraph/types";

const TOOLTIP = "rounded bg-slate-900 px-2 py-1 text-[11px] text-white shadow";

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

const groupClass = "flex items-center gap-1";

const Divider = () => <div className="h-6 w-px bg-slate-200" />;

const diagramOptions: Array<{ value: DiagramKind; label: string; icon: string }> = [
  { value: "FLUJO", label: "Flujo", icon: "🔵" },
  { value: "SECUENCIA", label: "Secuencia", icon: "🟣" },
  { value: "UML_CLASES", label: "Clases UML", icon: "🟢" },
  { value: "ENTIDAD_RELACION", label: "Entidad-Relación", icon: "🟠" },
  { value: "ESTADO", label: "Estado", icon: "🩵" },
  { value: "ARQUITECTURA", label: "Arquitectura C4", icon: "🔷" },
  { value: "BPMN", label: "BPMN", icon: "📘" }
];

export const MaxGraphToolbar = ({
  state,
  actions,
  diagramKind,
  onChangeDiagramKind
}: {
  state: GraphToolbarState;
  actions: GraphToolbarActions;
  diagramKind: DiagramKind;
  onChangeDiagramKind: (kind: DiagramKind) => void;
}) => {
  return (
    <header className="flex h-[52px] items-center gap-2 overflow-x-auto border-b border-[#e2e8f2] bg-white px-2">
      <div className={groupClass}>
        <button type="button" className={iconButtonClass} title="Selector (S o Esc)" onClick={() => actions.setTool("select")}>
          S
        </button>
        <button type="button" className={iconButtonClass} title="Pan (H o Espacio)" onClick={() => actions.setTool("pan")}>
          ✋
        </button>
        <button type="button" className={iconButtonClass} title="Conector (C)" onClick={() => actions.setTool("connect")}>
          ↔
        </button>
        <button type="button" className={iconButtonClass} title="Texto (T)" onClick={() => actions.setTool("text")}>
          T
        </button>
      </div>

      <Divider />

      <div className={groupClass}>
        <button type="button" className={iconButtonClass} title="Deshacer (Ctrl+Z)" onClick={actions.undo} disabled={!state.canUndo || state.readOnly}>
          ↶
        </button>
        <button type="button" className={iconButtonClass} title="Rehacer (Ctrl+Y)" onClick={actions.redo} disabled={!state.canRedo || state.readOnly}>
          ↷
        </button>
        <button type="button" className={iconButtonClass} title="Cortar (Ctrl+X)" onClick={actions.cut} disabled={state.readOnly}>
          ✂
        </button>
        <button type="button" className={iconButtonClass} title="Copiar (Ctrl+C)" onClick={actions.copy}>
          ⎘
        </button>
        <button type="button" className={iconButtonClass} title="Pegar (Ctrl+V)" onClick={actions.paste} disabled={state.readOnly}>
          📋
        </button>
        <button type="button" className={iconButtonClass} title="Duplicar (Ctrl+D)" onClick={actions.duplicate} disabled={state.readOnly}>
          ⧉
        </button>
        <button type="button" className={iconButtonClass} title="Eliminar (Delete)" onClick={actions.removeSelection} disabled={state.readOnly}>
          ⌫
        </button>
        <button type="button" className={iconButtonClass} title="Seleccionar todo (Ctrl+A)" onClick={actions.selectAll}>
          ☰
        </button>
      </div>

      <Divider />

      <div className={groupClass}>
        <button type="button" className={iconButtonClass} title="Zoom in (+)" onClick={actions.zoomIn}>
          +
        </button>
        <button type="button" className={iconButtonClass} title="Zoom out (-)" onClick={actions.zoomOut}>
          −
        </button>
        <input
          type="number"
          min={10}
          max={300}
          value={state.zoomPercent}
          onChange={(event) => actions.zoomToPercent(Number(event.target.value || 100))}
          className="h-9 w-16 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700"
          title="Zoom %"
        />
        <button type="button" className={iconButtonClass} title="Fit page (Ctrl+Shift+H)" onClick={actions.fit}>
          Fit
        </button>
        <button type="button" className={iconButtonClass} title="100%" onClick={actions.resetZoom}>
          100
        </button>
        <button type="button" className={iconButtonClass} title="Modo claro/oscuro" onClick={actions.toggleCanvasMode}>
          {state.canvasMode === "light" ? "☀" : "☾"}
        </button>
      </div>

      <Divider />

      <div className={groupClass}>
        <select
          value={state.gridMode}
          onChange={(event) => actions.setGridMode(event.target.value as "dots" | "lines" | "none")}
          className="h-9 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700"
          title="Grid"
        >
          <option value="dots">Grid puntos</option>
          <option value="lines">Grid líneas</option>
          <option value="none">Grid none</option>
        </select>
        <button type="button" className={iconButtonClass} title="Toggle guías" onClick={actions.toggleGuides}>
          {state.guidesEnabled ? "Guides✓" : "Guides"}
        </button>
        <button type="button" className={iconButtonClass} title="Toggle snap" onClick={actions.toggleSnap}>
          {state.snapEnabled ? "Snap✓" : "Snap"}
        </button>
        <button type="button" className={iconButtonClass} title="Minimap" onClick={actions.toggleMinimap}>
          Map
        </button>
        <button type="button" className={iconButtonClass} title="Pantalla completa" onClick={actions.toggleFullscreen}>
          ⤢
        </button>
      </div>

      <Divider />

      <div className={groupClass}>
        <button type="button" className={iconButtonClass} title="Agrupar (Ctrl+G)" onClick={actions.groupSelection} disabled={state.readOnly}>
          ⊞
        </button>
        <button type="button" className={iconButtonClass} title="Desagrupar (Ctrl+Shift+G)" onClick={actions.ungroupSelection} disabled={state.readOnly}>
          ⊟
        </button>
      </div>

      <Divider />

      <div className={groupClass}>
        <select
          value={diagramKind}
          onChange={(event) => onChangeDiagramKind(event.target.value as DiagramKind)}
          className="h-9 min-w-[180px] rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700"
          title="Tipo de diagrama"
          disabled={state.readOnly}
        >
          {diagramOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.icon} {option.label}
            </option>
          ))}
        </select>
      </div>

      <Divider />

      <div className={groupClass}>
        <button type="button" className={iconButtonClass} title="Plantillas" onClick={actions.openTemplates}>
          🗂
        </button>
        <button type="button" className={iconButtonClass} title="Importar XML" onClick={actions.openImportDialog}>
          ⤓
        </button>
        <button type="button" className={iconButtonClass} title="Exportar PNG" onClick={actions.exportPng}>
          PNG
        </button>
        <button type="button" className={iconButtonClass} title="Exportar SVG" onClick={actions.exportSvg}>
          SVG
        </button>
        <button type="button" className={iconButtonClass} title="Exportar XML draw.io" onClick={actions.exportXml}>
          XML
        </button>
        <button type="button" className={iconButtonClass} title="Exportar PDF" onClick={actions.exportPdf}>
          PDF
        </button>
        <button type="button" className={iconButtonClass} title="Compartir link" onClick={actions.copyShareLink}>
          🔗
        </button>
      </div>

      <span className={`${TOOLTIP} ml-auto whitespace-nowrap`}>
        Tool: {state.activeTool} · {state.zoomPercent}%
      </span>
    </header>
  );
};
