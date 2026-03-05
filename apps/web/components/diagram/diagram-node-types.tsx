import { memo, useEffect, useState, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { DiagramKind } from "@corelia/types";

import type { DiagramNodeData } from "@/lib/diagram/diagram-model";

type DiagramCanvasMode = "light" | "dark";

type NodeRuntimeMeta = {
  diagramKind: DiagramKind;
  canvasMode: DiagramCanvasMode;
  readOnly: boolean;
  isEditing: boolean;
  onStartEditing?: (nodeId: string) => void;
  onCommitLabel?: (nodeId: string, label: string) => void;
  onCancelEditing?: () => void;
};

type DiagramRenderNodeData = DiagramNodeData & {
  runtime?: NodeRuntimeMeta;
};

const HANDLE_CLASS =
  "!h-[10px] !w-[10px] !border-2 !border-white !bg-[#4f6ef7] !transition-all hover:!scale-125";

const SHADOW_BASE = "0 4px 16px rgba(0,0,0,.12)";
const SHADOW_SELECTED = "0 0 0 3px rgba(79,111,247,.25)";

const parseNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
};

const splitRows = (value: string | undefined): string[] =>
  (value ?? "")
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

const laneColor = (seed: string): { header: string; body: string } => {
  const colors = [
    { header: "#4f6ef7", body: "rgba(79,110,247,0.06)" },
    { header: "#10b981", body: "rgba(16,185,129,0.08)" },
    { header: "#f97316", body: "rgba(249,115,22,0.08)" },
    { header: "#8b5cf6", body: "rgba(139,92,246,0.08)" }
  ];
  const hash = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] ?? colors[0]!;
};

const resolveStateTone = (label: string): { header: string; glow: string } => {
  const normalized = label.toLowerCase();
  if (normalized.includes("error") || normalized.includes("fall")) {
    return { header: "linear-gradient(135deg,#ef4444,#dc2626)", glow: "rgba(239,68,68,.28)" };
  }
  if (
    normalized.includes("ok") ||
    normalized.includes("done") ||
    normalized.includes("complet") ||
    normalized.includes("success")
  ) {
    return { header: "linear-gradient(135deg,#10b981,#059669)", glow: "rgba(16,185,129,.28)" };
  }
  if (normalized.includes("pending") || normalized.includes("espera")) {
    return { header: "linear-gradient(135deg,#f59e0b,#d97706)", glow: "rgba(245,158,11,.28)" };
  }
  if (normalized.includes("cancel")) {
    return { header: "linear-gradient(135deg,#64748b,#475569)", glow: "rgba(100,116,139,.25)" };
  }

  return { header: "linear-gradient(135deg,#4f6ef7,#6366f1)", glow: "rgba(79,110,247,.28)" };
};

const resolveNodeGeometry = (data: DiagramRenderNodeData): { width?: number; height?: number } => {
  const width = parseNumber(data.properties?.nodeWidth);
  const height = parseNumber(data.properties?.nodeHeight);

  const geometry: { width?: number; height?: number } = {};
  if (width !== undefined) {
    geometry.width = width;
  }
  if (height !== undefined) {
    geometry.height = height;
  }

  return geometry;
};

const resolveNodeStyle = (props: NodeProps<DiagramRenderNodeData>) => {
  const borderColor = props.data.properties?.borderColor ?? "#e2e8f2";
  const borderWidth = parseNumber(props.data.properties?.borderWidth) ?? 1;
  const opacity = Number.parseFloat(props.data.properties?.opacity ?? "1");
  const hasShadow = props.data.properties?.shadow !== "off";
  const bgColor = props.data.properties?.bgColor;
  const textColor = props.data.properties?.textColor;
  const geometry = resolveNodeGeometry(props.data);

  return {
    borderColor,
    borderWidth,
    opacity: Number.isFinite(opacity) ? opacity : 1,
    hasShadow,
    bgColor,
    textColor,
    geometry
  };
};

const visibilityColorByPrefix: Record<string, string> = {
  "+": "#10b981",
  "-": "#ef4444",
  "#": "#f59e0b"
};

const LabelEditor = ({
  props,
  className,
  style
}: {
  props: NodeProps<DiagramRenderNodeData>;
  className: string;
  style?: CSSProperties;
}) => {
  const [draft, setDraft] = useState(props.data.label);
  const runtime = props.data.runtime;

  useEffect(() => {
    setDraft(props.data.label);
  }, [props.data.label, runtime?.isEditing]);

  const commit = () => {
    const next = draft.trim();
    runtime?.onCommitLabel?.(props.id, next.length > 0 ? next : props.data.label);
  };

  if (runtime?.isEditing && !runtime.readOnly) {
    return (
      <input
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
          }
          if (event.key === "Escape") {
            runtime?.onCancelEditing?.();
          }
        }}
        className="w-full rounded-md border border-blue-300 bg-white/90 px-2 py-1 text-center text-sm font-medium text-slate-800 outline-none"
      />
    );
  }

  return (
    <div className={className} style={style}>
      {props.data.label}
    </div>
  );
};

const standardHandles = (
  <>
    <Handle type="target" position={Position.Top} className={HANDLE_CLASS} />
    <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS} />
    <Handle type="target" position={Position.Left} className={HANDLE_CLASS} />
    <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
  </>
);

const decisionHandles = (
  <>
    <Handle type="target" position={Position.Top} className={HANDLE_CLASS} />
    <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
    <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS} />
    <Handle type="source" position={Position.Left} className={HANDLE_CLASS} />
  </>
);

const DiagramNodeRenderer = memo((props: NodeProps<DiagramRenderNodeData>) => {
  const runtime = props.data.runtime;
  const styleMeta = resolveNodeStyle(props);
  const baseCardStyle: CSSProperties = {
    opacity: styleMeta.opacity,
    boxShadow: props.selected
      ? `${SHADOW_BASE}, ${SHADOW_SELECTED}`
      : styleMeta.hasShadow
        ? SHADOW_BASE
        : "none",
    borderColor: props.selected ? "#4f6ef7" : styleMeta.borderColor,
    borderWidth: props.selected ? 2 : styleMeta.borderWidth,
    color: styleMeta.textColor ?? undefined,
    background: styleMeta.bgColor ?? undefined,
    width: styleMeta.geometry.width,
    minHeight: styleMeta.geometry.height
  };

  const rowTitleStyle: CSSProperties = {
    fontFamily: "var(--diagram-heading-font)",
    fontWeight: 700,
    letterSpacing: "0.01em"
  };

  const bodyStyle: CSSProperties = {
    fontFamily: "var(--diagram-body-font)",
    fontWeight: 500
  };

  const onNodeDoubleClick = () => {
    if (runtime?.readOnly) {
      return;
    }

    runtime?.onStartEditing?.(props.id);
  };

  if (
    props.data.elementType === "START_END" ||
    props.data.elementType === "START_EVENT" ||
    props.data.elementType === "END_EVENT"
  ) {
    const isEnd = /fin|end/i.test(props.data.label) || props.data.elementType === "END_EVENT";
    const gradient = isEnd
      ? "linear-gradient(135deg,#ef4444,#dc2626)"
      : "linear-gradient(135deg,#10b981,#059669)";

    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative flex min-h-[50px] min-w-[140px] items-center justify-center rounded-full border text-white"
        style={{
          ...baseCardStyle,
          borderColor: "transparent",
          background: gradient,
          boxShadow: isEnd ? "0 4px 16px rgba(220,38,38,.35)" : "0 4px 16px rgba(5,150,105,.35)"
        }}
      >
        {standardHandles}
        <span className="mr-1 text-sm">{isEnd ? "■" : "▶"}</span>
        <LabelEditor props={props} className="max-w-[94px] truncate text-sm font-semibold" style={rowTitleStyle} />
      </div>
    );
  }

  if (props.data.elementType === "PROCESS" || props.data.elementType === "ACTIVITY_TASK") {
    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative min-h-[70px] min-w-[180px] overflow-hidden rounded-[10px] border bg-white"
        style={baseCardStyle}
      >
        {standardHandles}
        <div className="h-2 w-full bg-[#4f6ef7]" />
        <div className="flex h-[calc(100%-8px)] items-center gap-2 px-3 py-2">
          <div className="rounded-md bg-[#eef1fe] px-2 py-1 text-[11px] font-semibold text-[#4f6ef7]">PROCESO</div>
          <LabelEditor props={props} className="line-clamp-2 text-sm text-slate-700" style={rowTitleStyle} />
        </div>
      </div>
    );
  }

  if (props.data.elementType === "DECISION" || props.data.elementType === "GATEWAY") {
    return (
      <div className="relative h-[124px] w-[124px]" onDoubleClick={onNodeDoubleClick}>
        {decisionHandles}
        <div
          className="absolute inset-1 rotate-45 rounded-md border-2"
          style={{
            borderColor: "#d97706",
            background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
            boxShadow: props.selected
              ? "0 0 0 3px rgba(79,111,247,.25), 0 4px 16px rgba(217,119,6,.25)"
              : "0 4px 16px rgba(217,119,6,.22)"
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <LabelEditor
            props={props}
            className="max-w-[84px] -rotate-45 text-sm font-semibold text-[#111827]"
            style={rowTitleStyle}
          />
        </div>
        <span className="pointer-events-none absolute -bottom-1 right-2 rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-700">Sí</span>
        <span className="pointer-events-none absolute -bottom-1 left-2 rounded bg-red-100 px-1 text-[10px] font-semibold text-red-700">No</span>
      </div>
    );
  }

  if (props.data.elementType === "INPUT_OUTPUT") {
    return (
      <div onDoubleClick={onNodeDoubleClick} className="relative min-h-[60px] min-w-[180px]" style={baseCardStyle}>
        {standardHandles}
        <div
          className="h-full w-full rounded-md px-4 py-2 text-center text-white"
          style={{
            clipPath: "polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%)",
            background: styleMeta.bgColor ?? "linear-gradient(135deg,#8b5cf6,#7c3aed)",
            boxShadow: props.selected
              ? "0 0 0 3px rgba(79,111,247,.25), 0 4px 16px rgba(124,58,237,.28)"
              : "0 4px 16px rgba(124,58,237,.22)"
          }}
        >
          <div className="mb-1 text-xs">↕</div>
          <LabelEditor props={props} className="text-sm font-semibold" style={rowTitleStyle} />
        </div>
      </div>
    );
  }

  if (props.data.elementType === "CONNECTOR") {
    return (
      <div onDoubleClick={onNodeDoubleClick} className="relative h-[64px] w-[64px]">
        {standardHandles}
        <div
          className="flex h-full w-full items-center justify-center rounded-full border-0 text-base font-bold text-white"
          style={{
            ...baseCardStyle,
            background: styleMeta.bgColor ?? "linear-gradient(135deg,#06b6d4,#0891b2)",
            boxShadow: props.selected
              ? "0 0 0 3px rgba(79,111,247,.25), 0 4px 16px rgba(8,145,178,.28)"
              : "0 4px 16px rgba(8,145,178,.24)"
          }}
        >
          {props.data.label.slice(0, 2).toUpperCase()}
        </div>
      </div>
    );
  }

  if (props.data.elementType === "POOL" || props.data.elementType === "LANE") {
    const lane = laneColor(props.id);
    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative min-h-[140px] min-w-[280px] overflow-hidden rounded-xl border"
        style={{
          ...baseCardStyle,
          borderColor: lane.header,
          background: lane.body
        }}
      >
        {standardHandles}
        <div
          className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
          style={{
            background: lane.header,
            fontFamily: "var(--diagram-heading-font)"
          }}
        >
          <span>{props.data.elementType === "POOL" ? "Swim Pool" : "Swim Lane"}</span>
          <span>{props.data.elementType === "POOL" ? "⊞" : "▤"}</span>
        </div>
        <div className="p-3 text-sm text-slate-700" style={bodyStyle}>
          <LabelEditor props={props} className="text-sm font-semibold text-slate-700" />
        </div>
      </div>
    );
  }

  if (props.data.elementType === "ACTOR" || props.data.elementType === "PARTICIPANT") {
    const isSystem = props.data.elementType === "PARTICIPANT";
    const headerColor = isSystem
      ? "linear-gradient(135deg,#10b981,#059669)"
      : "linear-gradient(135deg,#4f6ef7,#6366f1)";

    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative min-h-[80px] min-w-[170px] overflow-hidden rounded-xl border bg-white"
        style={{
          ...baseCardStyle,
          borderColor: isSystem ? "#10b981" : "#4f6ef7"
        }}
      >
        {standardHandles}
        <div
          className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white"
          style={{ background: headerColor, ...rowTitleStyle }}
        >
          <span>{isSystem ? "🖥" : "👤"}</span>
          <span>{isSystem ? "Sistema" : "Actor"}</span>
        </div>
        <div className="px-3 py-2 text-center text-sm text-slate-700" style={bodyStyle}>
          <LabelEditor props={props} className="font-semibold text-slate-700" style={rowTitleStyle} />
        </div>
      </div>
    );
  }

  if (props.data.elementType === "LIFELINE") {
    return (
      <div className="relative min-w-[140px]" onDoubleClick={onNodeDoubleClick}>
        {standardHandles}
        <div className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-center shadow-sm" style={baseCardStyle}>
          <LabelEditor props={props} className="text-sm font-semibold text-slate-700" style={rowTitleStyle} />
        </div>
        <div className="mx-auto h-36 border-l-2 border-dashed border-[#94a3b8]" />
      </div>
    );
  }

  if (props.data.elementType === "ACTIVATION_BAR") {
    return (
      <div className="relative h-[130px] w-[18px]" onDoubleClick={onNodeDoubleClick}>
        {standardHandles}
        <div
          className="h-full w-full rounded-full border border-[#4f6ef7]"
          style={{
            ...baseCardStyle,
            background: "linear-gradient(180deg,#4f6ef7,#6366f1)",
            boxShadow: "0 4px 16px rgba(79,111,247,.25)"
          }}
        />
      </div>
    );
  }

  if (props.data.elementType === "COMBINED_FRAGMENT") {
    const fragmentType = props.data.properties?.fragmentType ?? "loop";
    const fragmentColor: Record<string, string> = {
      loop: "#f97316",
      alt: "#8b5cf6",
      opt: "#10b981",
      par: "#4f6ef7"
    };
    const color = fragmentColor[fragmentType] ?? "#4f6ef7";

    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative min-h-[120px] min-w-[220px] rounded-lg border bg-white"
        style={{
          ...baseCardStyle,
          borderColor: "#e2e8f2",
          borderWidth: 1.5,
          background: `${color}0a`
        }}
      >
        {standardHandles}
        <div className="absolute left-3 top-2 rounded px-2 py-0.5 text-[11px] font-bold uppercase text-white" style={{ background: color }}>
          {fragmentType}
        </div>
        <div className="pt-9 text-center text-sm text-slate-700" style={bodyStyle}>
          <LabelEditor props={props} className="font-semibold" style={rowTitleStyle} />
        </div>
      </div>
    );
  }

  if (props.data.elementType === "CLASS") {
    const attributes = splitRows(props.data.properties?.attributes);
    const methods = splitRows(props.data.properties?.methods);
    const isInterface = (props.data.properties?.stereotype ?? "").toLowerCase().includes("interface");
    const isAbstract = props.data.properties?.isAbstract === "true";

    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative min-w-[220px] overflow-hidden rounded-xl border bg-white text-xs"
        style={baseCardStyle}
      >
        {standardHandles}
        <div
          className="px-3 py-2 text-center text-sm font-bold text-white"
          style={{
            ...rowTitleStyle,
            background: isInterface
              ? "linear-gradient(135deg,#8b5cf6,#7c3aed)"
              : "linear-gradient(135deg,#4f6ef7,#6366f1)",
            fontStyle: isAbstract ? "italic" : "normal"
          }}
        >
          <LabelEditor props={props} className="font-bold text-white" style={rowTitleStyle} />
          {isInterface ? <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">«interface»</span> : null}
          {isAbstract ? <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">abstract</span> : null}
        </div>

        <div className="border-b border-slate-200 bg-white px-3 py-2" style={bodyStyle}>
          {attributes.length > 0 ? (
            attributes.map((row, index) => {
              const prefix = row.charAt(0);
              const iconColor = visibilityColorByPrefix[prefix] ?? "#94a3b8";
              return (
                <div key={`attr-${index}-${row}`} className="flex items-center gap-1.5 text-[11px] text-slate-800">
                  <span style={{ color: iconColor }}>●</span>
                  <span className="truncate text-slate-800">{row}</span>
                </div>
              );
            })
          ) : (
            <div className="text-[11px] text-slate-400">+ id: UUID</div>
          )}
        </div>

        <div className="bg-[#f8faff] px-3 py-2" style={bodyStyle}>
          {methods.length > 0 ? (
            methods.map((row, index) => {
              const prefix = row.charAt(0);
              const iconColor = visibilityColorByPrefix[prefix] ?? "#94a3b8";
              return (
                <div key={`method-${index}-${row}`} className="flex items-center gap-1.5 text-[11px] text-slate-800">
                  <span style={{ color: iconColor }}>●</span>
                  <span className="truncate text-slate-800">{row}</span>
                </div>
              );
            })
          ) : (
            <div className="text-[11px] text-slate-400">+ save(): void</div>
          )}
        </div>
      </div>
    );
  }

  if (props.data.elementType === "ENTITY") {
    const attrs = splitRows(props.data.properties?.attributes);
    const primaryKeys = new Set(splitRows(props.data.properties?.primaryKeys).map((value) => value.toLowerCase()));
    const foreignKeys = new Set(splitRows(props.data.properties?.foreignKeys).map((value) => value.toLowerCase()));
    const palette = [
      "#4f6ef7",
      "#10b981",
      "#8b5cf6",
      "#f97316",
      "#06b6d4",
      "#ec4899",
      "#f59e0b",
      "#ef4444"
    ];
    const headerColor = palette[Math.abs(props.id.length + props.data.label.length) % palette.length] ?? "#4f6ef7";

    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative min-w-[220px] overflow-hidden rounded-xl border bg-white"
        style={{
          ...baseCardStyle,
          borderColor: headerColor,
          boxShadow: `0 4px 16px ${headerColor}22`
        }}
      >
        {standardHandles}
        <div className="px-3 py-2 text-sm font-bold text-white" style={{ background: headerColor, ...rowTitleStyle }}>
          <LabelEditor props={props} className="font-bold text-white" style={rowTitleStyle} />
        </div>
        <div className="space-y-1 px-3 py-2 text-xs text-slate-700" style={bodyStyle}>
          {attrs.length > 0 ? (
            attrs.map((attr, index) => {
              const normalized = attr.split(":")[0]?.trim().toLowerCase() ?? "";
              const isPk = primaryKeys.has(normalized) || /\bpk\b/i.test(attr);
              const isFk = foreignKeys.has(normalized) || /\bfk\b/i.test(attr);

              return (
                <div key={`entity-attr-${index}-${attr}`} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-800">
                    {isPk ? "🔑" : isFk ? "🔗" : "•"} {attr}
                  </span>
                  <span className="text-[10px] uppercase text-slate-400">{(attr.split(":")[1] ?? "").trim() || "TEXT"}</span>
                </div>
              );
            })
          ) : (
            <div className="text-[11px] text-slate-400">🔑 id: INT</div>
          )}
        </div>
      </div>
    );
  }

  if (props.data.elementType === "RELATIONSHIP") {
    return (
      <div className="relative h-[112px] w-[112px]" onDoubleClick={onNodeDoubleClick}>
        {decisionHandles}
        <div
          className="absolute inset-1 rotate-45 rounded-md border border-[#0f172a]"
          style={{
            background: "linear-gradient(135deg,#334155,#1e293b)",
            boxShadow: props.selected
              ? "0 0 0 3px rgba(79,111,247,.25), 0 4px 16px rgba(30,41,59,.3)"
              : "0 4px 16px rgba(30,41,59,.24)"
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <LabelEditor props={props} className="max-w-[80px] -rotate-45 text-xs font-semibold text-white" style={rowTitleStyle} />
        </div>
      </div>
    );
  }

  if (props.data.elementType === "ATTRIBUTE" || props.data.elementType === "PRIMARY_KEY") {
    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative min-h-[46px] min-w-[140px] rounded-full border bg-white px-3 py-2 text-center text-sm"
        style={{
          ...baseCardStyle,
          borderStyle: props.data.elementType === "PRIMARY_KEY" ? "double" : "solid",
          borderColor: props.data.elementType === "PRIMARY_KEY" ? "#f59e0b" : "#94a3b8"
        }}
      >
        {standardHandles}
        <LabelEditor
          props={props}
          className={`text-sm ${props.data.elementType === "PRIMARY_KEY" ? "underline" : ""}`}
          style={rowTitleStyle}
        />
      </div>
    );
  }

  if (props.data.elementType === "INITIAL_STATE") {
    return (
      <div className="relative h-[28px] w-[28px]">
        <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
        <div
          className="h-full w-full rounded-full bg-black"
          style={{
            boxShadow: props.selected ? `0 0 0 3px rgba(79,111,247,.25), ${SHADOW_BASE}` : SHADOW_BASE
          }}
        />
      </div>
    );
  }

  if (props.data.elementType === "FINAL_STATE") {
    return (
      <div className="relative h-[38px] w-[38px] rounded-full border-2 border-black p-[5px]">
        <Handle type="target" position={Position.Left} className={HANDLE_CLASS} />
        <div className="h-full w-full rounded-full bg-black" />
      </div>
    );
  }

  if (props.data.elementType === "STATE") {
    const tone = resolveStateTone(props.data.label);

    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative min-h-[90px] min-w-[190px] overflow-hidden rounded-[20px] border bg-white"
        style={{
          ...baseCardStyle,
          boxShadow: props.selected ? `${SHADOW_BASE}, ${SHADOW_SELECTED}` : `0 4px 16px ${tone.glow}`
        }}
      >
        {standardHandles}
        <div className="px-3 py-2 text-sm font-semibold text-white" style={{ background: tone.header, ...rowTitleStyle }}>
          <LabelEditor props={props} className="font-semibold text-white" style={rowTitleStyle} />
        </div>
        <div className="space-y-1 px-3 py-2 text-[11px] text-slate-500" style={bodyStyle}>
          <div>entry / {props.data.properties?.entryAction ?? "-"}</div>
          <div>do / {props.data.properties?.doAction ?? "-"}</div>
          <div>exit / {props.data.properties?.exitAction ?? "-"}</div>
        </div>
      </div>
    );
  }

  if (props.data.elementType === "DATABASE_STORAGE") {
    const engine = (props.data.properties?.engine ?? "database").toLowerCase();
    const colors: Record<string, string> = {
      postgresql: "#336791",
      mysql: "#f29111",
      mongodb: "#47a248",
      redis: "#dc382d"
    };
    const topColor = colors[engine] ?? "#334155";

    return (
      <div
        className="relative min-h-[110px] min-w-[190px] rounded-md border border-slate-300 bg-white px-3 pb-3 pt-5"
        style={baseCardStyle}
        onDoubleClick={onNodeDoubleClick}
      >
        {standardHandles}
        <div
          className="absolute left-1 right-1 top-0 h-5 rounded-full border border-slate-300"
          style={{ background: topColor }}
        />
        <div className="absolute bottom-1 left-1 right-1 h-4 rounded-full border border-slate-300 bg-white" />
        <div className="relative space-y-1 text-center">
          <div className="text-2xl">🗄</div>
          <LabelEditor props={props} className="text-sm font-semibold text-slate-800" style={rowTitleStyle} />
          <div className="text-[11px] uppercase text-slate-500">{props.data.properties?.engine ?? "Generic"}</div>
        </div>
      </div>
    );
  }

  if (
    props.data.elementType === "COMPONENT_SERVICE" ||
    props.data.elementType === "INTERFACE_API" ||
    props.data.elementType === "INFRA_SERVER" ||
    props.data.elementType === "INFRA_CLOUD" ||
    props.data.elementType === "INFRA_CONTAINER"
  ) {
    const isComponent = props.data.elementType === "COMPONENT_SERVICE";
    const isApi = props.data.elementType === "INTERFACE_API";
    const isCloud = props.data.elementType === "INFRA_CLOUD";
    const icon = isComponent ? "🧩" : isApi ? "⚙" : isCloud ? "☁" : props.data.elementType === "INFRA_CONTAINER" ? "📦" : "🖧";
    const header = isComponent
      ? "#10b981"
      : isApi
        ? "#3b82f6"
        : isCloud
          ? "#475569"
          : "#1e3a5f";

    return (
      <div
        onDoubleClick={onNodeDoubleClick}
        className="relative min-h-[110px] min-w-[210px] overflow-hidden rounded-xl border bg-white"
        style={baseCardStyle}
      >
        {standardHandles}
        <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white" style={{ background: header, ...rowTitleStyle }}>
          <span>{icon}</span>
          <LabelEditor props={props} className="truncate text-right text-sm font-semibold text-white" style={rowTitleStyle} />
        </div>
        <div className="space-y-2 px-3 py-2 text-xs text-slate-700" style={bodyStyle}>
          <div>{props.data.properties?.description ?? "Descripción del elemento"}</div>
          <div className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
            {props.data.properties?.technology ?? "Generic"}
          </div>
        </div>
      </div>
    );
  }

  const isDarkCanvas = runtime?.canvasMode === "dark";
  const genericBackground = isDarkCanvas ? "#1e293b" : "#ffffff";
  const genericText = isDarkCanvas ? "#e2e8f0" : "#334155";

  return (
    <div
      onDoubleClick={onNodeDoubleClick}
      className="relative min-h-[64px] min-w-[170px] rounded-xl border px-3 py-2"
      style={{
        ...baseCardStyle,
        background: styleMeta.bgColor ?? genericBackground,
        color: styleMeta.textColor ?? genericText
      }}
    >
      {standardHandles}
      <LabelEditor props={props} className="text-sm font-semibold" style={rowTitleStyle} />
    </div>
  );
});

DiagramNodeRenderer.displayName = "DiagramNodeRenderer";

export const diagramNodeTypes = {
  diagramNode: DiagramNodeRenderer
};
