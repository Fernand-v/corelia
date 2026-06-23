import type { GraphToolbarActions, GraphToolbarState } from "@/components/diagram/maxgraph/types";

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-sm text-ink transition hover:bg-line disabled:cursor-not-allowed disabled:opacity-40";

const textButtonClass =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-line bg-white px-2 text-[11px] font-semibold text-ink transition hover:bg-line disabled:cursor-not-allowed disabled:opacity-40";

const activeToolClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-paper text-sm text-ink transition disabled:cursor-not-allowed disabled:opacity-40";

const groupClass = "flex shrink-0 items-center gap-1";

const Divider = () => <div className="h-6 w-px shrink-0 bg-line" />;

export const MaxGraphToolbar = ({
  state,
  actions
}: {
  state: GraphToolbarState;
  actions: GraphToolbarActions;
}) => {
  return (
    <header className="overflow-x-auto border-b border-line bg-white">
      <div className="flex min-h-[52px] min-w-max items-center gap-2 px-2 py-1">
        <div className={groupClass}>
          <button type="button" className={state.activeTool === "select" ? activeToolClass : iconButtonClass} title="Selector (S o Esc)" onClick={() => actions.setTool("select")}>
            S
          </button>
          <button type="button" className={state.activeTool === "pan" ? activeToolClass : iconButtonClass} title="Pan (H o Espacio)" onClick={() => actions.setTool("pan")}>
            ✋
          </button>
          <button type="button" className={state.activeTool === "connect" ? activeToolClass : iconButtonClass} title="Conector (C)" onClick={() => actions.setTool("connect")}>
            ↔
          </button>
          <button type="button" className={state.activeTool === "text" ? activeToolClass : iconButtonClass} title="Texto (T)" onClick={() => actions.setTool("text")}>
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
            className="h-9 w-16 rounded-md border border-line px-2 text-xs font-semibold text-ink"
            title="Zoom %"
          />
          <button type="button" className={textButtonClass} title="Fit page (Ctrl+Shift+H)" onClick={actions.fit}>
            Fit
          </button>
          <button type="button" className={textButtonClass} title="100%" onClick={actions.resetZoom}>
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
            className="h-9 rounded-md border border-line px-2 text-xs font-semibold text-ink"
            title="Grid"
          >
            <option value="dots">Grid puntos</option>
            <option value="lines">Grid líneas</option>
            <option value="none">Grid none</option>
          </select>
          <button type="button" className={textButtonClass} title="Toggle guías" onClick={actions.toggleGuides}>
            {state.guidesEnabled ? "Guides✓" : "Guides"}
          </button>
          <button type="button" className={textButtonClass} title="Toggle snap" onClick={actions.toggleSnap}>
            {state.snapEnabled ? "Snap✓" : "Snap"}
          </button>
          <button type="button" className={textButtonClass} title="Minimap" onClick={actions.toggleMinimap}>
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
          <button type="button" className={iconButtonClass} title="Plantillas" onClick={actions.openTemplates}>
            🗂
          </button>
          <button type="button" className={iconButtonClass} title="Importar XML" onClick={actions.openImportDialog}>
            ⤓
          </button>
          <button type="button" className={textButtonClass} title="Exportar PNG" onClick={actions.exportPng}>
            PNG
          </button>
          <button type="button" className={textButtonClass} title="Exportar SVG" onClick={actions.exportSvg}>
            SVG
          </button>
          <button type="button" className={textButtonClass} title="Exportar XML draw.io" onClick={actions.exportXml}>
            XML
          </button>
          <button type="button" className={textButtonClass} title="Exportar PDF" onClick={actions.exportPdf}>
            PDF
          </button>
          <button type="button" className={iconButtonClass} title="Compartir link" onClick={actions.copyShareLink}>
            🔗
          </button>
        </div>
      </div>
    </header>
  );
};
