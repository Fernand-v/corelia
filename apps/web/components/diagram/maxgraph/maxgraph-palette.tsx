import { useMemo } from "react";

import type { EdgeTemplate, ShapeTemplate } from "@/lib/diagram/maxgraph/palette-catalog";
import type { PaletteActions, PaletteViewModel } from "@/components/diagram/maxgraph/types";

const COLLAPSE_KEY_PREFIX = "corelia.maxgraph.palette.section.";

const sectionButtonClass =
  "flex w-full items-center justify-between rounded-md bg-line px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-mid";

const cardClass =
  "group rounded-lg border border-line bg-white p-2 text-left transition hover:-translate-y-[1px] hover:border-line hover:bg-paper";

const edgeCardClass =
  "rounded-lg border border-line bg-white p-2 text-left transition hover:border-line hover:bg-paper";

const ShapePreviewSvg = ({ style }: { style: Record<string, string | number | boolean> }) => {
  const fill = (style.fillColor as string | undefined) ?? "#ffffff";
  const stroke = (style.strokeColor as string | undefined) ?? "#64748b";
  const shape = style.shape as string | undefined;
  const rounded = style.rounded;
  const dashed = style.dashed ? "4 3" : undefined;

  if (shape === "ellipse") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <ellipse cx="40" cy="24" rx="38" ry="22" fill={fill} stroke={stroke} strokeWidth={1.5} strokeDasharray={dashed} />
      </svg>
    );
  }
  if (shape === "doubleEllipse") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <ellipse cx="40" cy="24" rx="38" ry="22" fill={fill} stroke={stroke} strokeWidth={1.5} />
        <ellipse cx="40" cy="24" rx="31" ry="15" fill="none" stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }
  if (shape === "rhombus") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <polygon points="40,2 78,24 40,46 2,24" fill={fill} stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }
  if (shape === "parallelogram") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <polygon points="14,2 78,2 66,46 2,46" fill={fill} stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }
  if (shape === "hexagon") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <polygon points="20,2 60,2 78,24 60,46 20,46 2,24" fill={fill} stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }
  if (shape === "cylinder") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <rect x="2" y="10" width="76" height="28" fill={fill} stroke="none" />
        <ellipse cx="40" cy="10" rx="38" ry="8" fill={fill} stroke={stroke} strokeWidth={1.5} />
        <line x1="2" y1="10" x2="2" y2="38" stroke={stroke} strokeWidth={1.5} />
        <line x1="78" y1="10" x2="78" y2="38" stroke={stroke} strokeWidth={1.5} />
        <path d="M2,38 a38,8 0 0,0 76,0" fill={fill} stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }
  if (shape === "cloud") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <path d="M16,38 Q4,38 4,28 Q4,18 14,18 Q14,8 24,8 Q30,2 38,6 Q46,0 54,6 Q66,4 70,14 Q78,14 78,24 Q78,38 64,38 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }
  if (shape === "swimlane") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <rect x="2" y="2" width="76" height="44" fill={fill} stroke={stroke} strokeWidth={1.5} strokeDasharray={dashed} />
        {style.horizontal !== 0
          ? <line x1="2" y1="14" x2="78" y2="14" stroke={stroke} strokeWidth={1.5} />
          : <line x1="20" y1="2" x2="20" y2="46" stroke={stroke} strokeWidth={1.5} />
        }
      </svg>
    );
  }
  if (shape === "note") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <path d="M2,2 L62,2 L78,18 L78,46 L2,46 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
        <path d="M62,2 L62,18 L78,18" fill="none" stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }
  if (shape === "umlActor") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <circle cx="40" cy="9" r="7" fill={fill} stroke={stroke} strokeWidth={1.5} />
        <line x1="40" y1="16" x2="40" y2="34" stroke={stroke} strokeWidth={1.5} />
        <line x1="26" y1="24" x2="54" y2="24" stroke={stroke} strokeWidth={1.5} />
        <line x1="40" y1="34" x2="29" y2="46" stroke={stroke} strokeWidth={1.5} />
        <line x1="40" y1="34" x2="51" y2="46" stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }
  if (shape === "line") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <line x1="40" y1="2" x2="40" y2="46" stroke={stroke} strokeWidth={2} strokeDasharray={dashed} />
      </svg>
    );
  }
  if (shape === "folder") {
    return (
      <svg viewBox="0 0 80 48" className="h-10 w-full">
        <path d="M2,14 L2,46 L78,46 L78,18 L40,18 L32,14 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
        <path d="M2,14 L32,14 L40,18" fill="none" stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }

  // Default: rectangle with optional rounded corners
  return (
    <svg viewBox="0 0 80 48" className="h-10 w-full">
      <rect x="2" y="2" width="76" height="44" rx={rounded ? "8" : "2"} fill={fill} stroke={stroke} strokeWidth={1.5} strokeDasharray={dashed} />
    </svg>
  );
};

const EdgePreview = ({ template }: { template: EdgeTemplate }) => {
  const stroke = (template.style.strokeColor as string | undefined) ?? "#64748b";
  const dashed = template.style.dashed ? "6 4" : undefined;

  return (
    <svg viewBox="0 0 96 24" className="h-6 w-full">
      <line x1="8" y1="12" x2="86" y2="12" stroke={stroke} strokeWidth={2} strokeDasharray={dashed} />
      {template.style.endArrow === "none" ? null : <polygon points="86,12 78,8 78,16" fill={stroke} />}
      {template.style.startArrow ? <polygon points="8,12 16,8 16,16" fill={stroke} /> : null}
    </svg>
  );
};

const ShapeCard = ({
  template,
  readOnly,
  onInsert
}: {
  template: ShapeTemplate;
  readOnly: boolean;
  onInsert: (template: ShapeTemplate) => void;
}) => {
  return (
    <button
      type="button"
      className={`${cardClass} disabled:cursor-not-allowed disabled:opacity-45`}
      title={`${template.label} · ${template.description}`}
      disabled={readOnly}
      draggable={!readOnly}
      onDragStart={(event) => {
        const payload = JSON.stringify({
          templateId: template.id,
          kind: "shape"
        });
        event.dataTransfer.setData(
          "application/corelia-maxgraph-template",
          payload
        );
        // Safari compatibility: preserve a plain-text payload alongside custom MIME type.
        event.dataTransfer.setData("text/plain", `corelia-maxgraph-template:${payload}`);
        event.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onInsert(template)}
    >
      <div className="mx-auto mb-1 w-20 overflow-hidden rounded-md border border-line shadow-sm">
        <ShapePreviewSvg style={template.style} />
      </div>
      <p className="truncate text-center text-[11px] font-semibold text-ink">{template.label}</p>
    </button>
  );
};

const EdgeCard = ({
  template,
  selected,
  readOnly,
  onSelect
}: {
  template: EdgeTemplate;
  selected: boolean;
  readOnly: boolean;
  onSelect: (template: EdgeTemplate) => void;
}) => (
  <button
    type="button"
    className={`${edgeCardClass} ${
      selected ? "border-line bg-paper" : ""
    } disabled:cursor-not-allowed disabled:opacity-45`}
    title={`${template.label} · ${template.description}`}
    disabled={readOnly}
    onClick={() => onSelect(template)}
  >
    <EdgePreview template={template} />
    <p className="mt-1 truncate text-center text-[11px] font-semibold text-ink">{template.label}</p>
  </button>
);

export const persistPaletteSectionState = (id: string, collapsed: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(`${COLLAPSE_KEY_PREFIX}${id}`, collapsed ? "1" : "0");
};

export const loadPaletteSectionState = (id: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(`${COLLAPSE_KEY_PREFIX}${id}`) === "1";
};

export const MaxGraphPalette = ({
  viewModel,
  actions
}: {
  viewModel: PaletteViewModel;
  actions: PaletteActions;
}) => {
  const search = viewModel.search.trim().toLowerCase();

  const filteredLibraries = useMemo(() => {
    if (!search) {
      return viewModel.libraries;
    }

    return viewModel.libraries
      .map((library) => {
        const shapes = library.shapes.filter((shape) => {
          const text = `${shape.label} ${shape.description} ${shape.category}`.toLowerCase();
          return text.includes(search);
        });

        const edges = (library.edges ?? []).filter((edge) => {
          const text = `${edge.label} ${edge.description} ${edge.category}`.toLowerCase();
          return text.includes(search);
        });

        return {
          ...library,
          shapes,
          edges
        };
      })
      .filter((library) => library.shapes.length > 0 || (library.edges?.length ?? 0) > 0);
  }, [search, viewModel.libraries]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-[#e2e8f2] bg-white xl:w-[260px]">
      <div className="border-b border-[#e2e8f2] p-3">
        <p className="text-[11px] uppercase tracking-wide text-mid">Paleta de Shapes</p>
        <input
          value={viewModel.search}
          onChange={(event) => actions.onSearch(event.target.value)}
          placeholder="Buscar en librerías..."
          className="mt-2 h-9 w-full rounded-md border border-line px-2 text-xs text-ink outline-none focus:border-line"
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {filteredLibraries.map((library) => {
          const sectionId = `${library.section}:${library.id}`;
          const collapsed = viewModel.collapsed[sectionId] === true;

          return (
            <section key={sectionId} className="space-y-2">
              <button
                type="button"
                className={sectionButtonClass}
                onClick={() => actions.toggleSection(sectionId)}
              >
                <span>{library.name}</span>
                <span>{collapsed ? "+" : "−"}</span>
              </button>

              {!collapsed ? (
                <>
                  {library.shapes.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {library.shapes.map((template) => (
                        <ShapeCard
                          key={`${sectionId}:${template.id}`}
                          template={template}
                          readOnly={viewModel.readOnly}
                          onInsert={actions.insertShape}
                        />
                      ))}
                    </div>
                  ) : null}

                  {(library.edges ?? []).length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-mid">
                        Conectores
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {(library.edges ?? []).map((template) => (
                          <EdgeCard
                            key={`${sectionId}:edge:${template.id}`}
                            template={template}
                            selected={viewModel.selectedEdgeTemplateId === template.id}
                            readOnly={viewModel.readOnly}
                            onSelect={actions.selectEdgeTemplate}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
};
