import { useMemo, useState } from "react";
import type { DiagramKind } from "@corelia/types";

import { DIAGRAM_KIND_VISUALS, EDGE_VISUALS, NODE_VISUALS } from "@/components/diagram/diagram-visuals";
import type { DiagramEdgeModel, DiagramNodeModel } from "@/lib/diagram/diagram-model";

const FIELD_CLASS =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-400";

const relationSupportsMultiplicity = new Set([
  "ASSOCIATION",
  "INHERITANCE",
  "AGGREGATION",
  "COMPOSITION"
]);

const relationSupportsCardinality = new Set(["ER_LINK"]);
const relationSupportsTrigger = new Set(["TRANSITION"]);

const getNodeProperty = (node: DiagramNodeModel, key: string): string =>
  node.data.properties?.[key] ?? "";

const getEdgeProperty = (edge: DiagramEdgeModel, key: string): string =>
  edge.data?.properties?.[key] ?? "";

const parseNumber = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const appendLine = (source: string, nextValue: string): string => {
  const trimmed = source.trim();
  if (!trimmed) {
    return nextValue;
  }

  return `${trimmed}\n${nextValue}`;
};

const sectionTitleClass = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export const DiagramPropertiesPanel = ({
  diagramKind,
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  readOnly,
  onNodeLabelChange,
  onNodePropertyChange,
  onNodePositionChange,
  onNodeSizeChange,
  onCenterNode,
  onEdgeLabelChange,
  onEdgePropertyChange,
  onHighlightEdge,
  onDeleteEdge
}: {
  diagramKind: DiagramKind;
  nodes: DiagramNodeModel[];
  edges: DiagramEdgeModel[];
  selectedNode: DiagramNodeModel | null;
  selectedEdge: DiagramEdgeModel | null;
  readOnly: boolean;
  onNodeLabelChange: (nodeId: string, value: string) => void;
  onNodePropertyChange: (nodeId: string, key: string, value: string) => void;
  onNodePositionChange: (nodeId: string, x: number, y: number) => void;
  onNodeSizeChange: (nodeId: string, width: number, height: number) => void;
  onCenterNode: (nodeId: string) => void;
  onEdgeLabelChange: (edgeId: string, value: string) => void;
  onEdgePropertyChange: (edgeId: string, key: string, value: string) => void;
  onHighlightEdge: (edgeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
}) => {
  const showNode = Boolean(selectedNode);
  const showEdge = !showNode && Boolean(selectedEdge);
  const kindVisual = DIAGRAM_KIND_VISUALS[diagramKind];
  const [lockRatio, setLockRatio] = useState(true);

  const connectedEdges = useMemo(() => {
    if (!selectedNode) {
      return [];
    }

    return edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id);
  }, [edges, selectedNode]);

  return (
    <aside className="flex h-full min-h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-[#e2e8f2] bg-white shadow-sm xl:w-[280px]">
      <div className="border-b border-[#e2e8f2] px-3 py-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-500" style={{ fontFamily: "var(--diagram-body-font)" }}>
          Inspector
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-800" style={{ fontFamily: "var(--diagram-heading-font)" }}>
            {showNode && selectedNode
              ? `${NODE_VISUALS[selectedNode.data.elementType].icon} ${NODE_VISUALS[selectedNode.data.elementType].shortLabel}`
              : showEdge && selectedEdge
                ? `${EDGE_VISUALS[selectedEdge.data?.relationType ?? "FLOW_ARROW"].icon} Relación`
                : "Sin selección"}
          </p>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: kindVisual.color }}>
            {kindVisual.label}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {showNode && selectedNode ? (
          <>
            <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className={sectionTitleClass}>Contenido</p>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Label</span>
                <input
                  value={selectedNode.data.label}
                  onChange={(event) => onNodeLabelChange(selectedNode.id, event.target.value)}
                  disabled={readOnly}
                  className={FIELD_CLASS}
                />
              </label>

              {selectedNode.data.elementType === "CLASS" ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Atributos</span>
                    <textarea
                      rows={4}
                      value={getNodeProperty(selectedNode, "attributes")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "attributes", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      onNodePropertyChange(
                        selectedNode.id,
                        "attributes",
                        appendLine(getNodeProperty(selectedNode, "attributes"), "+ name: string")
                      )
                    }
                    disabled={readOnly}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + atributo
                  </button>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Métodos</span>
                    <textarea
                      rows={4}
                      value={getNodeProperty(selectedNode, "methods")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "methods", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      onNodePropertyChange(
                        selectedNode.id,
                        "methods",
                        appendLine(getNodeProperty(selectedNode, "methods"), "+ save(): void")
                      )
                    }
                    disabled={readOnly}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + método
                  </button>
                </>
              ) : null}

              {selectedNode.data.elementType === "ENTITY" ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Atributos (uno por línea)</span>
                    <textarea
                      rows={4}
                      value={getNodeProperty(selectedNode, "attributes")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "attributes", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">PK</span>
                    <input
                      value={getNodeProperty(selectedNode, "primaryKeys")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "primaryKeys", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">FK</span>
                    <input
                      value={getNodeProperty(selectedNode, "foreignKeys")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "foreignKeys", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                </>
              ) : null}

              {selectedNode.data.elementType === "STATE" ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Entry</span>
                    <input
                      value={getNodeProperty(selectedNode, "entryAction")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "entryAction", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Do</span>
                    <input
                      value={getNodeProperty(selectedNode, "doAction")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "doAction", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Exit</span>
                    <input
                      value={getNodeProperty(selectedNode, "exitAction")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "exitAction", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                </>
              ) : null}

              {selectedNode.data.elementType === "COMBINED_FRAGMENT" ? (
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Tipo de fragmento</span>
                  <select
                    value={getNodeProperty(selectedNode, "fragmentType") || "loop"}
                    onChange={(event) =>
                      onNodePropertyChange(selectedNode.id, "fragmentType", event.target.value)
                    }
                    disabled={readOnly}
                    className={FIELD_CLASS}
                  >
                    <option value="loop">loop</option>
                    <option value="alt">alt</option>
                    <option value="opt">opt</option>
                    <option value="par">par</option>
                  </select>
                </label>
              ) : null}

              {[
                "COMPONENT_SERVICE",
                "INTERFACE_API",
                "DATABASE_STORAGE",
                "INFRA_SERVER",
                "INFRA_CLOUD",
                "INFRA_CONTAINER"
              ].includes(selectedNode.data.elementType) ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Descripción</span>
                    <textarea
                      rows={3}
                      value={getNodeProperty(selectedNode, "description")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "description", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Tecnología</span>
                    <input
                      value={getNodeProperty(selectedNode, "technology")}
                      onChange={(event) =>
                        onNodePropertyChange(selectedNode.id, "technology", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                </>
              ) : null}
            </section>

            <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className={sectionTitleClass}>Estilo</p>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Fondo</span>
                  <input
                    type="color"
                    value={getNodeProperty(selectedNode, "bgColor") || "#ffffff"}
                    onChange={(event) =>
                      onNodePropertyChange(selectedNode.id, "bgColor", event.target.value)
                    }
                    disabled={readOnly}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white p-1"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Borde</span>
                  <input
                    type="color"
                    value={getNodeProperty(selectedNode, "borderColor") || "#e2e8f2"}
                    onChange={(event) =>
                      onNodePropertyChange(selectedNode.id, "borderColor", event.target.value)
                    }
                    disabled={readOnly}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white p-1"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Grosor de borde (1-4)</span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={getNodeProperty(selectedNode, "borderWidth") || "1"}
                  onChange={(event) =>
                    onNodePropertyChange(selectedNode.id, "borderWidth", event.target.value)
                  }
                  disabled={readOnly}
                  className="w-full"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Opacidad</span>
                <input
                  type="range"
                  min={0.25}
                  max={1}
                  step={0.05}
                  value={getNodeProperty(selectedNode, "opacity") || "1"}
                  onChange={(event) =>
                    onNodePropertyChange(selectedNode.id, "opacity", event.target.value)
                  }
                  disabled={readOnly}
                  className="w-full"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={getNodeProperty(selectedNode, "shadow") !== "off"}
                  onChange={(event) =>
                    onNodePropertyChange(selectedNode.id, "shadow", event.target.checked ? "on" : "off")
                  }
                  disabled={readOnly}
                />
                Sombra
              </label>
            </section>

            <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className={sectionTitleClass}>Posición y Tamaño</p>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">X</span>
                  <input
                    type="number"
                    value={Math.round(selectedNode.position.x)}
                    onChange={(event) => {
                      const nextX = parseNumber(event.target.value);
                      if (nextX === null) {
                        return;
                      }

                      onNodePositionChange(selectedNode.id, nextX, Math.round(selectedNode.position.y));
                    }}
                    disabled={readOnly}
                    className={FIELD_CLASS}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Y</span>
                  <input
                    type="number"
                    value={Math.round(selectedNode.position.y)}
                    onChange={(event) => {
                      const nextY = parseNumber(event.target.value);
                      if (nextY === null) {
                        return;
                      }

                      onNodePositionChange(selectedNode.id, Math.round(selectedNode.position.x), nextY);
                    }}
                    disabled={readOnly}
                    className={FIELD_CLASS}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Ancho</span>
                  <input
                    type="number"
                    value={getNodeProperty(selectedNode, "nodeWidth") || ""}
                    placeholder="auto"
                    onChange={(event) => {
                      const width = parseNumber(event.target.value);
                      if (width === null) {
                        onNodePropertyChange(selectedNode.id, "nodeWidth", "");
                        return;
                      }

                      const currentWidth =
                        parseNumber(getNodeProperty(selectedNode, "nodeWidth")) ??
                        selectedNode.width ??
                        180;
                      const currentHeight =
                        parseNumber(getNodeProperty(selectedNode, "nodeHeight")) ??
                        selectedNode.height ??
                        120;
                      const ratio = currentHeight / Math.max(1, currentWidth);
                      const nextHeight = lockRatio
                        ? Math.max(40, Math.round(width * ratio))
                        : currentHeight;

                      onNodeSizeChange(selectedNode.id, width, nextHeight);
                    }}
                    disabled={readOnly}
                    className={FIELD_CLASS}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Alto</span>
                  <input
                    type="number"
                    value={getNodeProperty(selectedNode, "nodeHeight") || ""}
                    placeholder="auto"
                    onChange={(event) => {
                      const height = parseNumber(event.target.value);
                      if (height === null) {
                        onNodePropertyChange(selectedNode.id, "nodeHeight", "");
                        return;
                      }

                      const currentWidth =
                        parseNumber(getNodeProperty(selectedNode, "nodeWidth")) ??
                        selectedNode.width ??
                        180;
                      const currentHeight =
                        parseNumber(getNodeProperty(selectedNode, "nodeHeight")) ??
                        selectedNode.height ??
                        120;
                      const ratio = currentWidth / Math.max(1, currentHeight);
                      const nextWidth = lockRatio
                        ? Math.max(60, Math.round(height * ratio))
                        : currentWidth;

                      onNodeSizeChange(selectedNode.id, nextWidth, height);
                    }}
                    disabled={readOnly}
                    className={FIELD_CLASS}
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
                onClick={() => onCenterNode(selectedNode.id)}
                disabled={readOnly}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Centrar en canvas
              </button>
            </section>

            <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className={sectionTitleClass}>Conexiones ({connectedEdges.length})</p>

              {connectedEdges.length > 0 ? (
                <div className="space-y-2">
                  {connectedEdges.map((edge) => {
                    const oppositeNodeId = edge.source === selectedNode.id ? edge.target : edge.source;
                    const oppositeNode = nodes.find((node) => node.id === oppositeNodeId);

                    return (
                      <div key={edge.id} className="rounded-md border border-slate-200 bg-white p-2">
                        <p className="text-[11px] font-semibold text-slate-700">
                          {(edge.data?.relationType ?? "FLOW_ARROW").replaceAll("_", " ")} · {oppositeNode?.data.label ?? oppositeNodeId}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => onHighlightEdge(edge.id)}
                            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700"
                          >
                            Resaltar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteEdge(edge.id)}
                            disabled={readOnly}
                            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded border border-dashed border-slate-300 bg-white px-2 py-3 text-xs text-slate-500">
                  Este nodo no tiene conexiones.
                </p>
              )}
            </section>
          </>
        ) : null}

        {showEdge && selectedEdge ? (
          <>
            <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className={sectionTitleClass}>Contenido</p>

              <div className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">
                {selectedEdge.data?.relationType ?? "FLOW_ARROW"}
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Label</span>
                <input
                  value={typeof selectedEdge.label === "string" ? selectedEdge.label : ""}
                  onChange={(event) => onEdgeLabelChange(selectedEdge.id, event.target.value)}
                  disabled={readOnly}
                  className={FIELD_CLASS}
                />
              </label>

              {relationSupportsMultiplicity.has(selectedEdge.data?.relationType ?? "FLOW_ARROW") ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Multiplicidad origen</span>
                    <input
                      value={getEdgeProperty(selectedEdge, "sourceMultiplicity")}
                      onChange={(event) =>
                        onEdgePropertyChange(selectedEdge.id, "sourceMultiplicity", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Multiplicidad destino</span>
                    <input
                      value={getEdgeProperty(selectedEdge, "targetMultiplicity")}
                      onChange={(event) =>
                        onEdgePropertyChange(selectedEdge.id, "targetMultiplicity", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                </div>
              ) : null}

              {relationSupportsCardinality.has(selectedEdge.data?.relationType ?? "FLOW_ARROW") ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Cardinalidad origen</span>
                    <input
                      value={getEdgeProperty(selectedEdge, "sourceCardinality")}
                      onChange={(event) =>
                        onEdgePropertyChange(selectedEdge.id, "sourceCardinality", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Cardinalidad destino</span>
                    <input
                      value={getEdgeProperty(selectedEdge, "targetCardinality")}
                      onChange={(event) =>
                        onEdgePropertyChange(selectedEdge.id, "targetCardinality", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                </div>
              ) : null}

              {relationSupportsTrigger.has(selectedEdge.data?.relationType ?? "FLOW_ARROW") ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Evento</span>
                    <input
                      value={getEdgeProperty(selectedEdge, "trigger")}
                      onChange={(event) =>
                        onEdgePropertyChange(selectedEdge.id, "trigger", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Condición</span>
                    <input
                      value={getEdgeProperty(selectedEdge, "condition")}
                      onChange={(event) =>
                        onEdgePropertyChange(selectedEdge.id, "condition", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Acción</span>
                    <input
                      value={getEdgeProperty(selectedEdge, "action")}
                      onChange={(event) =>
                        onEdgePropertyChange(selectedEdge.id, "action", event.target.value)
                      }
                      disabled={readOnly}
                      className={FIELD_CLASS}
                    />
                  </label>
                </>
              ) : null}

              {selectedEdge.data?.relationType === "MESSAGE" ? (
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Tipo de mensaje</span>
                  <select
                    value={getEdgeProperty(selectedEdge, "messageType") || "sync"}
                    onChange={(event) =>
                      onEdgePropertyChange(selectedEdge.id, "messageType", event.target.value)
                    }
                    disabled={readOnly}
                    className={FIELD_CLASS}
                  >
                    <option value="sync">Síncrono</option>
                    <option value="async">Asíncrono</option>
                    <option value="response">Respuesta</option>
                  </select>
                </label>
              ) : null}
            </section>

            <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className={sectionTitleClass}>Estilo</p>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Color línea</span>
                  <input
                    type="color"
                    value={getEdgeProperty(selectedEdge, "lineColor") || "#64748b"}
                    onChange={(event) =>
                      onEdgePropertyChange(selectedEdge.id, "lineColor", event.target.value)
                    }
                    disabled={readOnly}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white p-1"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Grosor</span>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    value={getEdgeProperty(selectedEdge, "lineWidth") || "2"}
                    onChange={(event) =>
                      onEdgePropertyChange(selectedEdge.id, "lineWidth", event.target.value)
                    }
                    disabled={readOnly}
                    className="w-full"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onHighlightEdge(selectedEdge.id)}
                  className="flex-1 rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-700"
                >
                  Resaltar
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteEdge(selectedEdge.id)}
                  disabled={readOnly}
                  className="flex-1 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </section>
          </>
        ) : null}

        {!showNode && !showEdge ? (
          <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
            Selecciona un nodo o una relación para editar sus propiedades visuales y contenido.
          </p>
        ) : null}
      </div>
    </aside>
  );
};
