import { useMemo, useState } from "react";
import type { DiagramKind } from "@corelia/types";

import type {
  DiagramEdgeTemplate,
  DiagramNodeTemplate,
  DiagramPaletteDefinition
} from "@/lib/diagram/diagram-palette-catalog";
import { DIAGRAM_KIND_VISUALS } from "@/components/diagram/diagram-visuals";

const groupByCategory = <T extends { category: string }>(items: T[]): Array<[string, T[]]> => {
  const bucket = new Map<string, T[]>();

  for (const item of items) {
    const current = bucket.get(item.category);
    if (current) {
      current.push(item);
      continue;
    }

    bucket.set(item.category, [item]);
  }

  return Array.from(bucket.entries());
};

const NODE_PREVIEW_CLASS =
  "mx-auto flex h-12 w-20 items-center justify-center overflow-hidden rounded-md border text-[10px] font-semibold shadow-sm";

const NodePreview = ({ template }: { template: DiagramNodeTemplate }) => {
  if (template.id === "START_END" || template.id === "START_EVENT" || template.id === "END_EVENT") {
    return (
      <div
        className={`${NODE_PREVIEW_CLASS} rounded-full border-0 text-white`}
        style={{
          background:
            template.id === "END_EVENT"
              ? "linear-gradient(135deg,#ef4444,#dc2626)"
              : "linear-gradient(135deg,#10b981,#059669)"
        }}
      >
        {template.id === "END_EVENT" ? "■" : "▶"}
      </div>
    );
  }

  if (template.id === "DECISION" || template.id === "GATEWAY" || template.id === "RELATIONSHIP") {
    return (
      <div className="mx-auto h-12 w-12 rotate-45 rounded-md border-2 border-[#d97706] bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm">
        <span className="block -rotate-45 text-center text-[10px] font-bold text-slate-900">?</span>
      </div>
    );
  }

  if (template.id === "INPUT_OUTPUT") {
    return (
      <div
        className="mx-auto h-10 w-20 border text-xs font-semibold text-white shadow-sm"
        style={{
          clipPath: "polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)",
          background: "linear-gradient(135deg,#8b5cf6,#7c3aed)"
        }}
      >
        <div className="flex h-full items-center justify-center">I/O</div>
      </div>
    );
  }

  if (template.id === "CONNECTOR" || template.id === "INITIAL_STATE" || template.id === "FINAL_STATE") {
    return (
      <div
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-[11px] text-white shadow-sm"
        style={{
          background:
            template.id === "CONNECTOR"
              ? "linear-gradient(135deg,#06b6d4,#0891b2)"
              : template.id === "FINAL_STATE"
                ? "#0f172a"
                : "#000"
        }}
      >
        {template.id === "FINAL_STATE" ? "◉" : "●"}
      </div>
    );
  }

  if (template.id === "LIFELINE") {
    return (
      <div className="mx-auto w-20">
        <div className="rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-[10px]">Actor</div>
        <div className="mx-auto h-8 w-0 border-l-2 border-dashed border-slate-400" />
      </div>
    );
  }

  if (template.id === "ACTIVATION_BAR") {
    return <div className="mx-auto h-10 w-2 rounded bg-[#4f6ef7] shadow-sm" />;
  }

  if (template.id === "CLASS") {
    return (
      <div className="mx-auto w-20 overflow-hidden rounded border border-slate-300 bg-white text-[9px]">
        <div className="bg-gradient-to-r from-[#4f6ef7] to-[#6366f1] px-1 py-0.5 text-center font-semibold text-white">Class</div>
        <div className="border-b border-slate-200 px-1 py-0.5">+id:UUID</div>
        <div className="px-1 py-0.5">+save()</div>
      </div>
    );
  }

  if (template.id === "ENTITY") {
    return (
      <div className="mx-auto w-20 overflow-hidden rounded border border-[#10b981] bg-white text-[9px]">
        <div className="bg-[#10b981] px-1 py-0.5 text-center font-semibold text-white">Entity</div>
        <div className="px-1 py-0.5">🔑 id INT</div>
      </div>
    );
  }

  if (template.id === "DATABASE_STORAGE") {
    return (
      <div className="mx-auto mt-1 h-10 w-20 rounded-md border border-slate-300 bg-white px-1 text-center text-[10px] shadow-sm">
        <div className="-mt-2 mx-auto h-3 w-16 rounded-full bg-[#336791]" />
        <div className="mt-1">🗄 DB</div>
      </div>
    );
  }

  if (template.id === "POOL" || template.id === "LANE") {
    return (
      <div className="mx-auto h-12 w-20 overflow-hidden rounded border border-[#4f6ef7] bg-blue-50 text-[10px] shadow-sm">
        <div className="bg-[#4f6ef7] px-1 py-0.5 text-center text-white">{template.id === "POOL" ? "POOL" : "LANE"}</div>
      </div>
    );
  }

  return (
    <div className={`${NODE_PREVIEW_CLASS} border-slate-300 bg-white text-slate-600`}>{template.icon}</div>
  );
};

const EdgePreview = ({ template }: { template: DiagramEdgeTemplate }) => {
  const pathClass = "stroke-[2px]";

  if (template.id === "INHERITANCE") {
    return (
      <svg viewBox="0 0 90 20" className="mx-auto h-5 w-24">
        <line x1="6" y1="10" x2="66" y2="10" className={`${pathClass} stroke-[#4f6ef7]`} />
        <polygon points="66,10 82,3 82,17" fill="white" stroke="#4f6ef7" strokeWidth="2" />
      </svg>
    );
  }

  if (template.id === "AGGREGATION") {
    return (
      <svg viewBox="0 0 90 20" className="mx-auto h-5 w-24">
        <polygon points="10,10 16,4 22,10 16,16" fill="white" stroke="#10b981" strokeWidth="1.6" />
        <line x1="22" y1="10" x2="78" y2="10" className={`${pathClass} stroke-[#10b981]`} />
      </svg>
    );
  }

  if (template.id === "COMPOSITION") {
    return (
      <svg viewBox="0 0 90 20" className="mx-auto h-5 w-24">
        <polygon points="10,10 16,4 22,10 16,16" fill="#0f172a" stroke="#0f172a" strokeWidth="1.6" />
        <line x1="22" y1="10" x2="78" y2="10" className={`${pathClass} stroke-[#0f172a]`} />
      </svg>
    );
  }

  if (template.id === "ER_LINK") {
    return (
      <svg viewBox="0 0 90 20" className="mx-auto h-5 w-24">
        <line x1="8" y1="10" x2="82" y2="10" className={`${pathClass} stroke-[#64748b]`} />
        <text x="42" y="8" className="fill-slate-500 text-[6px]">1..N</text>
      </svg>
    );
  }

  if (template.id === "TRANSITION") {
    return (
      <svg viewBox="0 0 90 20" className="mx-auto h-5 w-24">
        <path d="M8 10 C24 2, 60 18, 80 10" fill="none" className={`${pathClass} stroke-[#64748b]`} />
        <polygon points="80,10 73,6 73,14" fill="#64748b" />
      </svg>
    );
  }

  if (template.id === "SEQUENCE_FLOW") {
    return (
      <svg viewBox="0 0 90 20" className="mx-auto h-5 w-24">
        <line
          x1="8"
          y1="10"
          x2="80"
          y2="10"
          stroke="#475569"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        <polygon points="80,10 73,6 73,14" fill="#475569" />
      </svg>
    );
  }

  if (template.id === "MESSAGE") {
    return (
      <svg viewBox="0 0 90 20" className="mx-auto h-5 w-24">
        <line x1="8" y1="10" x2="80" y2="10" className={`${pathClass} stroke-[#0f172a]`} />
        <polygon points="80,10 73,6 73,14" fill="#0f172a" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 90 20" className="mx-auto h-5 w-24">
      <line x1="8" y1="10" x2="80" y2="10" className={`${pathClass} stroke-[#64748b]`} />
      <polygon points="80,10 73,6 73,14" fill="#64748b" />
    </svg>
  );
};

const sectionButtonClass =
  "flex w-full items-center justify-between rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600";

export const DiagramPalette = ({
  kind,
  palette,
  readOnly,
  activeEdgeTemplateId,
  onInsertNode,
  onSelectEdgeTemplate
}: {
  kind: DiagramKind;
  palette: DiagramPaletteDefinition;
  readOnly: boolean;
  activeEdgeTemplateId: string | undefined;
  onInsertNode: (template: DiagramNodeTemplate) => void;
  onSelectEdgeTemplate: (template: DiagramEdgeTemplate) => void;
}) => {
  const nodeGroups = useMemo(() => groupByCategory(palette.nodeTemplates), [palette.nodeTemplates]);
  const edgeGroups = useMemo(() => groupByCategory(palette.edgeTemplates), [palette.edgeTemplates]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const visual = DIAGRAM_KIND_VISUALS[kind];

  const toggleSection = (key: string) => {
    setCollapsed((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  return (
    <aside className="flex h-full min-h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-[#e2e8f2] bg-white shadow-sm xl:w-[260px]">
      <div className="border-b border-[#e2e8f2] px-3 py-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-500" style={{ fontFamily: "var(--diagram-body-font)" }}>
          Paleta visual
        </p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800" style={{ fontFamily: "var(--diagram-heading-font)" }}>
            {visual.icon} {visual.label}
          </p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: visual.color }}>
            Drag + Click
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <section className="space-y-2">
          {nodeGroups.map(([category, templates]) => {
            const key = `nodes:${category}`;
            const isCollapsed = collapsed[key] === true;

            return (
              <div key={category} className="space-y-2">
                <button type="button" className={sectionButtonClass} onClick={() => toggleSection(key)}>
                  <span>{category}</span>
                  <span>{isCollapsed ? "+" : "−"}</span>
                </button>

                {!isCollapsed ? (
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        title={template.tooltip}
                        disabled={readOnly}
                        draggable={!readOnly}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("application/corelia-node-template", template.id);
                          event.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => onInsertNode(template)}
                        className="group space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:-translate-y-[1px] hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <NodePreview template={template} />
                        <p className="truncate text-center text-[11px] font-semibold text-slate-700" style={{ fontFamily: "var(--diagram-body-font)" }}>
                          {template.label}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        <section className="space-y-2 pb-2">
          {edgeGroups.map(([category, templates]) => {
            const key = `edges:${category}`;
            const isCollapsed = collapsed[key] === true;

            return (
              <div key={category} className="space-y-2">
                <button type="button" className={sectionButtonClass} onClick={() => toggleSection(key)}>
                  <span>{category}</span>
                  <span>{isCollapsed ? "+" : "−"}</span>
                </button>

                {!isCollapsed ? (
                  <div className="space-y-2">
                    {templates.map((template) => {
                      const active = activeEdgeTemplateId === template.id;

                      return (
                        <button
                          key={template.id}
                          type="button"
                          title={template.tooltip}
                          disabled={readOnly}
                          onClick={() => onSelectEdgeTemplate(template)}
                          className={`w-full rounded-lg border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            active
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                          }`}
                        >
                          <EdgePreview template={template} />
                          <p className="mt-1 text-center text-[11px] font-semibold text-slate-700" style={{ fontFamily: "var(--diagram-body-font)" }}>
                            {template.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      </div>
    </aside>
  );
};
