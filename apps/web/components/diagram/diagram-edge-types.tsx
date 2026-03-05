import { memo, useEffect, useState, type CSSProperties } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "reactflow";

import type { DiagramEdgeData } from "@/lib/diagram/diagram-model";

type EdgeRuntimeMeta = {
  readOnly: boolean;
  isEditing: boolean;
  highlighted?: boolean;
  onStartEditing?: (edgeId: string) => void;
  onCommitLabel?: (edgeId: string, label: string) => void;
  onCancelEditing?: () => void;
};

type DiagramRenderEdgeData = DiagramEdgeData & {
  runtime?: EdgeRuntimeMeta;
};

type EdgeVisual = {
  style: CSSProperties;
  markerEnd?: string;
  markerStart?: string;
  animated?: boolean;
};

const resolveEdgeVisual = (props: EdgeProps<DiagramRenderEdgeData>): EdgeVisual => {
  const relationType = props.data?.relationType ?? "FLOW_ARROW";
  const lowerLabel = typeof props.label === "string" ? props.label.toLowerCase() : "";
  const isYes = lowerLabel === "sí" || lowerLabel === "si" || lowerLabel.includes("sí");
  const isNo = lowerLabel === "no" || lowerLabel.includes("no");

  switch (relationType) {
    case "MESSAGE": {
      const messageType = props.data?.properties?.messageType ?? "sync";
      if (messageType === "response") {
        return {
          style: {
            stroke: "#94a3b8",
            strokeWidth: 1.8,
            strokeDasharray: "7 5"
          },
          markerEnd: "url(#corelia-open-arrow)"
        };
      }

      if (messageType === "async") {
        return {
          style: {
            stroke: "#0f172a",
            strokeWidth: 1.7
          },
          markerEnd: "url(#corelia-open-arrow)"
        };
      }

      return {
        style: {
          stroke: "#0f172a",
          strokeWidth: 2.1
        },
        markerEnd: "url(#corelia-solid-arrow)"
      };
    }

    case "INHERITANCE":
      return {
        style: {
          stroke: "#4f6ef7",
          strokeWidth: 2
        },
        markerEnd: "url(#corelia-hollow-triangle)"
      };

    case "AGGREGATION":
      return {
        style: {
          stroke: "#10b981",
          strokeWidth: 2
        },
        markerStart: "url(#corelia-hollow-diamond)",
        markerEnd: "url(#corelia-solid-arrow)"
      };

    case "COMPOSITION":
      return {
        style: {
          stroke: "#0f172a",
          strokeWidth: 2.2
        },
        markerStart: "url(#corelia-solid-diamond)",
        markerEnd: "url(#corelia-solid-arrow)"
      };

    case "ASSOCIATION":
      return {
        style: {
          stroke: "#64748b",
          strokeWidth: 1.9
        },
        markerEnd: "url(#corelia-solid-arrow)"
      };

    case "ER_LINK":
      return {
        style: {
          stroke: "#64748b",
          strokeWidth: 2
        },
        markerEnd: "url(#corelia-solid-arrow)"
      };

    case "TRANSITION":
      return {
        style: {
          stroke: "#64748b",
          strokeWidth: 2
        },
        markerEnd: "url(#corelia-solid-arrow)"
      };

    case "CONNECTION":
      return {
        style: {
          stroke: "#64748b",
          strokeWidth: 2,
          strokeDasharray: props.data?.properties?.connectionType === "async" ? "8 4" : undefined
        },
        markerEnd: "url(#corelia-solid-arrow)"
      };

    case "SEQUENCE_FLOW":
      return {
        style: {
          stroke: "#475569",
          strokeWidth: 1.9,
          strokeDasharray: "8 4"
        },
        markerEnd: "url(#corelia-solid-arrow)"
      };

    case "FLOW_ARROW":
    default:
      return {
        style: {
          stroke: isYes ? "#10b981" : isNo ? "#ef4444" : "#64748b",
          strokeWidth: 2,
          strokeDasharray: props.data?.properties?.optional === "true" ? "8 4" : undefined
        },
        markerEnd: "url(#corelia-solid-arrow)"
      };
  }
};

const endpointBadgeClass =
  "pointer-events-none absolute rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm";

const DiagramRelationEdge = memo((props: EdgeProps<DiagramRenderEdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition
  });

  const runtime = props.data?.runtime;
  const [draftLabel, setDraftLabel] = useState(typeof props.label === "string" ? props.label : "");

  useEffect(() => {
    setDraftLabel(typeof props.label === "string" ? props.label : "");
  }, [props.label, runtime?.isEditing]);

  const visual = resolveEdgeVisual(props);
  const highlighted = props.selected || runtime?.highlighted;
  const sourceMeta =
    props.data?.properties?.sourceMultiplicity ?? props.data?.properties?.sourceCardinality;
  const targetMeta =
    props.data?.properties?.targetMultiplicity ?? props.data?.properties?.targetCardinality;

  const effectiveStyle: CSSProperties = {
    ...visual.style,
    ...(props.style ?? {}),
    filter: highlighted ? "drop-shadow(0 0 6px rgba(79,111,247,.45))" : undefined
  };

  const commitLabel = () => {
    runtime?.onCommitLabel?.(props.id, draftLabel);
  };

  const markerEnd = props.markerEnd ? String(props.markerEnd) : visual.markerEnd;
  const markerStart = props.markerStart ? String(props.markerStart) : visual.markerStart;
  const baseEdgeProps: {
    path: string;
    style: CSSProperties;
    markerEnd?: string;
    markerStart?: string;
  } = {
    path: edgePath,
    style: effectiveStyle
  };

  if (markerEnd) {
    baseEdgeProps.markerEnd = markerEnd;
  }
  if (markerStart) {
    baseEdgeProps.markerStart = markerStart;
  }

  return (
    <>
      <BaseEdge {...baseEdgeProps} />

      <EdgeLabelRenderer>
        <div
          className="absolute"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {runtime?.isEditing && !runtime.readOnly ? (
            <input
              value={draftLabel}
              autoFocus
              onChange={(event) => setDraftLabel(event.target.value)}
              onBlur={commitLabel}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitLabel();
                }
                if (event.key === "Escape") {
                  runtime?.onCancelEditing?.();
                }
              }}
              className="pointer-events-auto w-40 rounded border border-blue-300 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => runtime?.onStartEditing?.(props.id)}
              className="pointer-events-auto rounded border border-slate-200 bg-white/95 px-2 py-0.5 text-[11px] text-slate-700 shadow-sm"
              title="Doble clic para editar etiqueta"
            >
              {typeof props.label === "string" && props.label.trim().length > 0
                ? props.label
                : "Etiqueta"}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>

      {sourceMeta ? (
        <EdgeLabelRenderer>
          <div
            className={endpointBadgeClass}
            style={{
              transform: `translate(-50%, -50%) translate(${props.sourceX}px, ${props.sourceY}px)`
            }}
          >
            {sourceMeta}
          </div>
        </EdgeLabelRenderer>
      ) : null}

      {targetMeta ? (
        <EdgeLabelRenderer>
          <div
            className={endpointBadgeClass}
            style={{
              transform: `translate(-50%, -50%) translate(${props.targetX}px, ${props.targetY}px)`
            }}
          >
            {targetMeta}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
DiagramRelationEdge.displayName = "DiagramRelationEdge";

export const diagramEdgeTypes = {
  diagramRelation: DiagramRelationEdge
};
