"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { jsPDF } from "jspdf";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import * as Y from "yjs";

type ChartPoint = {
  label: string;
  value: number;
};

type TextBlock = {
  id: string;
  type: "text";
  content: string;
};

type ImageBlock = {
  id: string;
  type: "image";
  url: string;
};

type ChartBlock = {
  id: string;
  type: "chart";
  title: string;
  data: ChartPoint[];
};

type SlideBlock = TextBlock | ImageBlock | ChartBlock;

type Slide = {
  id: string;
  title: string;
  background: string;
  blocks: SlideBlock[];
};

type PresentationState = {
  activeSlideId: string;
  slides: Slide[];
};

type BlockUpdate = {
  content?: string;
  url?: string;
  title?: string;
  data?: ChartPoint[];
};

const DEFAULT_BACKGROUND = "#ffffff";

const buildChartSeed = (): ChartPoint[] => [
  { label: "A", value: 10 },
  { label: "B", value: 14 },
  { label: "C", value: 8 }
];

const buildDefaultState = (): PresentationState => ({
  activeSlideId: "slide-1",
  slides: [
    {
      id: "slide-1",
      title: "Nueva presentación",
      background: DEFAULT_BACKGROUND,
      blocks: [
        {
          id: "block-1",
          type: "text",
          content: "Contenido de la diapositiva"
        }
      ]
    }
  ]
});

const chartDataToCsv = (data: ChartPoint[]) => {
  return data.map((item) => `${item.label},${item.value}`).join("\n");
};

const chartDataFromCsv = (value: string): ChartPoint[] => {
  const rows = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = rows
    .map((line) => {
      const [labelRaw, valueRaw] = line.split(",");
      if (!labelRaw || !valueRaw) {
        return null;
      }

      const numericValue = Number(valueRaw.trim());
      if (!Number.isFinite(numericValue)) {
        return null;
      }

      return {
        label: labelRaw.trim(),
        value: numericValue
      } as ChartPoint;
    })
    .filter((item): item is ChartPoint => Boolean(item));

  return parsed.length > 0 ? parsed : buildChartSeed();
};

const normalizeBlock = (block: unknown, index: number): SlideBlock => {
  const source = (block ?? {}) as Partial<SlideBlock> & {
    content?: unknown;
    url?: unknown;
    title?: unknown;
    data?: unknown;
  };

  const id = typeof source.id === "string" && source.id.trim() ? source.id : `block-${index + 1}`;
  const type = source.type;

  if (type === "image") {
    return {
      id,
      type,
      url: typeof source.url === "string" ? source.url : ""
    };
  }

  if (type === "chart") {
    const chartData = Array.isArray(source.data)
      ? source.data
          .map((item) => {
            const point = item as Partial<ChartPoint>;
            const label = typeof point.label === "string" ? point.label : "";
            const value = Number(point.value);
            if (!label || !Number.isFinite(value)) {
              return null;
            }
            return { label, value };
          })
          .filter((item): item is ChartPoint => Boolean(item))
      : [];

    return {
      id,
      type,
      title: typeof source.title === "string" ? source.title : "Gráfico",
      data: chartData.length > 0 ? chartData : buildChartSeed()
    };
  }

  return {
    id,
    type: "text",
    content: typeof source.content === "string" ? source.content : ""
  };
};

const normalizeSlide = (slide: unknown, index: number): Slide => {
  const source = (slide ?? {}) as Partial<Slide> & {
    body?: unknown;
    blocks?: unknown;
  };

  const fallbackTextBlock: TextBlock = {
    id: `block-text-${index + 1}`,
    type: "text",
    content: typeof source.body === "string" ? source.body : ""
  };

  const blocks = Array.isArray(source.blocks)
    ? source.blocks.map((item, blockIndex) => normalizeBlock(item, blockIndex))
    : [fallbackTextBlock];

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : `slide-${index + 1}`,
    title: typeof source.title === "string" ? source.title : `Diapositiva ${index + 1}`,
    background: typeof source.background === "string" ? source.background : DEFAULT_BACKGROUND,
    blocks: blocks.length > 0 ? blocks : [fallbackTextBlock]
  };
};

const parsePresentation = (value: string): PresentationState => {
  if (!value.trim()) {
    return buildDefaultState();
  }

  try {
    const parsed = JSON.parse(value) as Partial<PresentationState>;
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return buildDefaultState();
    }

    const slides = parsed.slides.map((slide, index) => normalizeSlide(slide, index));
    const activeSlideId =
      slides.find((slide) => slide.id === parsed.activeSlideId)?.id ?? slides[0]!.id;

    return {
      slides,
      activeSlideId
    };
  } catch {
    return buildDefaultState();
  }
};

const buildYBlock = (block: SlideBlock) => {
  const yBlock = new Y.Map<unknown>();
  yBlock.set("id", block.id);
  yBlock.set("type", block.type);

  if (block.type === "text") {
    yBlock.set("content", block.content);
  }

  if (block.type === "image") {
    yBlock.set("url", block.url);
  }

  if (block.type === "chart") {
    yBlock.set("title", block.title);
    yBlock.set("data", JSON.stringify(block.data));
  }

  return yBlock;
};

const buildYSlide = (slide: Slide) => {
  const ySlide = new Y.Map<unknown>();
  ySlide.set("id", slide.id);
  ySlide.set("title", slide.title);
  ySlide.set("background", slide.background);

  const yBlocks = new Y.Array<Y.Map<unknown>>();
  for (const block of slide.blocks) {
    yBlocks.push([buildYBlock(block)]);
  }

  ySlide.set("blocks", yBlocks);
  return ySlide;
};

const readPresentationFromY = (yRoot: Y.Map<unknown>): PresentationState => {
  const ySlides = yRoot.get("slides");
  if (!(ySlides instanceof Y.Array)) {
    return buildDefaultState();
  }

  const slides = ySlides
    .toArray()
    .map((item, index) => {
      if (!(item instanceof Y.Map)) {
        return normalizeSlide({}, index);
      }

      const yBlocks = item.get("blocks");
      const blocks = yBlocks instanceof Y.Array
        ? yBlocks
            .toArray()
            .map((entry, blockIndex) => {
              if (!(entry instanceof Y.Map)) {
                return normalizeBlock({}, blockIndex);
              }

              const type = String(entry.get("type") ?? "text");
              if (type === "image") {
                return normalizeBlock(
                  {
                    id: String(entry.get("id") ?? ""),
                    type,
                    url: String(entry.get("url") ?? "")
                  },
                  blockIndex
                );
              }

              if (type === "chart") {
                const dataRaw = String(entry.get("data") ?? "[]");
                const chartData = (() => {
                  try {
                    const parsed = JSON.parse(dataRaw) as ChartPoint[];
                    if (!Array.isArray(parsed)) {
                      return buildChartSeed();
                    }
                    return parsed;
                  } catch {
                    return buildChartSeed();
                  }
                })();

                return normalizeBlock(
                  {
                    id: String(entry.get("id") ?? ""),
                    type,
                    title: String(entry.get("title") ?? "Gráfico"),
                    data: chartData
                  },
                  blockIndex
                );
              }

              return normalizeBlock(
                {
                  id: String(entry.get("id") ?? ""),
                  type: "text",
                  content: String(entry.get("content") ?? "")
                },
                blockIndex
              );
            })
        : [];

      return normalizeSlide(
        {
          id: String(item.get("id") ?? ""),
          title: String(item.get("title") ?? ""),
          background: String(item.get("background") ?? DEFAULT_BACKGROUND),
          blocks
        },
        index
      );
    })
    .filter(Boolean);

  if (slides.length === 0) {
    return buildDefaultState();
  }

  const activeSlideIdRaw = yRoot.get("activeSlideId");
  const activeSlideId =
    typeof activeSlideIdRaw === "string" && slides.some((slide) => slide.id === activeSlideIdRaw)
      ? activeSlideIdRaw
      : slides[0]!.id;

  return {
    activeSlideId,
    slides
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "").trim();
  const normalized = clean.length === 3 ? clean.split("").map((char) => `${char}${char}`).join("") : clean;
  const value = Number.parseInt(normalized, 16);

  if (!Number.isFinite(value)) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

const imageUrlToDataUrl = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("No se pudo preparar canvas para imagen"));
        return;
      }

      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("No se pudo cargar imagen"));
    image.src = url;
  });
};

const renderSlideBlocks = (slide: Slide) => {
  return slide.blocks.map((block) => {
    if (block.type === "text") {
      return (
        <p key={block.id} className="whitespace-pre-wrap text-base text-slate-700">
          {block.content || "Texto vacío"}
        </p>
      );
    }

    if (block.type === "image") {
      return block.url ? (
        <img
          key={block.id}
          src={block.url}
          alt="Imagen de diapositiva"
          className="max-h-[280px] w-full rounded-lg border border-slate-200 object-contain"
        />
      ) : (
        <div
          key={block.id}
          className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500"
        >
          Imagen sin URL
        </div>
      );
    }

    return (
      <div key={block.id} className="h-[240px] rounded-lg border border-slate-200 bg-white p-2">
        <p className="mb-2 text-sm font-semibold text-slate-700">{block.title}</p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={block.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  });
};

export const DocumentsEditorPresentation = ({
  documentId,
  value,
  readOnly,
  provider,
  onUploadImage,
  onChange
}: {
  documentId: string;
  value: string;
  readOnly: boolean;
  provider?: HocuspocusProvider | null;
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  onUploadImage?: (file: File) => Promise<{ url: string } | null>;
  onChange: (value: string) => void;
}) => {
  const fallbackDocRef = useRef<Y.Doc | null>(null);
  if (!fallbackDocRef.current) {
    fallbackDocRef.current = new Y.Doc();
  }

  const yDoc = provider?.document ?? fallbackDocRef.current;
  const yRoot = useMemo(
    () => yDoc.getMap<unknown>(`doc:${documentId}:presentation:state`),
    [documentId, yDoc]
  );
  const yLegacyText = useMemo(() => yDoc.getText(`doc:${documentId}:presentation`), [documentId, yDoc]);

  const [state, setState] = useState<PresentationState>(() => parsePresentation(value || yLegacyText.toString()));
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadTargetBlockId, setUploadTargetBlockId] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const lastSerializedRef = useRef("");

  const activeSlide = state.slides.find((slide) => slide.id === state.activeSlideId) ?? state.slides[0] ?? null;
  const presentSlide = state.slides[presentIndex] ?? state.slides[0] ?? null;

  const writeStateToY = useCallback(
    (nextState: PresentationState) => {
      yDoc.transact(() => {
        const ySlides = new Y.Array<Y.Map<unknown>>();
        for (const slide of nextState.slides) {
          ySlides.push([buildYSlide(slide)]);
        }
        yRoot.set("slides", ySlides);
        yRoot.set("activeSlideId", nextState.activeSlideId);
        yRoot.set("initialized", true);
      });
    },
    [yDoc, yRoot]
  );

  const ensureInitialized = useCallback(() => {
    if (yRoot.get("initialized") === true) {
      return;
    }

    const seed = parsePresentation(value || yLegacyText.toString());
    writeStateToY(seed);

    const payload = JSON.stringify(seed);
    if (yLegacyText.toString() !== payload) {
      yLegacyText.delete(0, yLegacyText.length);
      yLegacyText.insert(0, payload);
    }
  }, [value, writeStateToY, yLegacyText, yRoot]);

  const syncFromY = useCallback(() => {
    const nextState = readPresentationFromY(yRoot);
    const payload = JSON.stringify(nextState);

    lastSerializedRef.current = payload;
    setState(nextState);
    onChange(payload);

    if (yLegacyText.toString() !== payload) {
      yLegacyText.delete(0, yLegacyText.length);
      yLegacyText.insert(0, payload);
    }
  }, [onChange, yLegacyText, yRoot]);

  useEffect(() => {
    ensureInitialized();
    syncFromY();

    const handleYChange = () => {
      syncFromY();
    };

    yRoot.observeDeep(handleYChange);
    return () => {
      yRoot.unobserveDeep(handleYChange);
    };
  }, [ensureInitialized, syncFromY, yRoot]);

  useEffect(() => {
    if (!value.trim() || value === lastSerializedRef.current) {
      return;
    }

    writeStateToY(parsePresentation(value));
  }, [value, writeStateToY]);

  useEffect(() => {
    if (!isPresenting || !state.slides.length) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setPresentIndex((current) => clamp(current + 1, 0, state.slides.length - 1));
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setPresentIndex((current) => clamp(current - 1, 0, state.slides.length - 1));
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsPresenting(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPresenting, state.slides.length]);

  const withSlidesArray = () => {
    const ySlides = yRoot.get("slides");
    return ySlides instanceof Y.Array ? ySlides : null;
  };

  const setActiveSlide = (slideId: string) => {
    yRoot.set("activeSlideId", slideId);
  };

  const addSlide = () => {
    if (readOnly) {
      return;
    }

    const ySlides = withSlidesArray();
    if (!ySlides) {
      return;
    }

    const slideId = `slide-${Date.now()}`;
    const newSlide: Slide = {
      id: slideId,
      title: `Diapositiva ${state.slides.length + 1}`,
      background: DEFAULT_BACKGROUND,
      blocks: [
        {
          id: `block-${Date.now()}`,
          type: "text",
          content: ""
        }
      ]
    };

    ySlides.push([buildYSlide(newSlide)]);
    yRoot.set("activeSlideId", slideId);
  };

  const duplicateSlide = () => {
    if (readOnly || !activeSlide) {
      return;
    }

    const ySlides = withSlidesArray();
    if (!ySlides) {
      return;
    }

    const cloneId = `slide-${Date.now()}`;
    const clone: Slide = {
      ...activeSlide,
      id: cloneId,
      title: `${activeSlide.title} (copia)`,
      blocks: activeSlide.blocks.map((block) => ({
        ...block,
        id: `${block.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`
      }))
    };

    const sourceIndex = state.slides.findIndex((slide) => slide.id === activeSlide.id);
    const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : ySlides.length;
    ySlides.insert(insertIndex, [buildYSlide(clone)]);
    yRoot.set("activeSlideId", cloneId);
  };

  const removeSlide = () => {
    if (readOnly || !activeSlide || state.slides.length <= 1) {
      return;
    }

    const ySlides = withSlidesArray();
    if (!ySlides) {
      return;
    }

    const index = state.slides.findIndex((slide) => slide.id === activeSlide.id);
    if (index < 0) {
      return;
    }

    ySlides.delete(index, 1);

    const remaining = state.slides.filter((slide) => slide.id !== activeSlide.id);
    yRoot.set("activeSlideId", remaining[Math.max(0, index - 1)]?.id ?? remaining[0]?.id ?? "");
  };

  const moveSlide = (direction: -1 | 1) => {
    if (readOnly || !activeSlide) {
      return;
    }

    const ySlides = withSlidesArray();
    if (!ySlides) {
      return;
    }

    const index = state.slides.findIndex((slide) => slide.id === activeSlide.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= state.slides.length) {
      return;
    }

    const moving = ySlides.get(index);
    if (!(moving instanceof Y.Map)) {
      return;
    }

    ySlides.delete(index, 1);
    ySlides.insert(nextIndex, [moving]);
  };

  const getActiveSlideYMap = () => {
    const ySlides = withSlidesArray();
    if (!ySlides || !activeSlide) {
      return null;
    }

    const index = state.slides.findIndex((slide) => slide.id === activeSlide.id);
    if (index < 0) {
      return null;
    }

    const ySlide = ySlides.get(index);
    return ySlide instanceof Y.Map ? ySlide : null;
  };

  const updateActiveSlideMeta = (field: "title" | "background", nextValue: string) => {
    if (readOnly) {
      return;
    }

    const ySlide = getActiveSlideYMap();
    if (!ySlide) {
      return;
    }

    ySlide.set(field, nextValue);
  };

  const getActiveSlideBlocksArray = () => {
    const ySlide = getActiveSlideYMap();
    if (!ySlide) {
      return null;
    }

    const yBlocks = ySlide.get("blocks");
    return yBlocks instanceof Y.Array ? yBlocks : null;
  };

  const addBlock = (type: SlideBlock["type"]) => {
    if (readOnly) {
      return;
    }

    const yBlocks = getActiveSlideBlocksArray();
    if (!yBlocks) {
      return;
    }

    const id = `block-${Date.now()}-${Math.round(Math.random() * 999)}`;

    if (type === "text") {
      yBlocks.push([
        buildYBlock({
          id,
          type,
          content: ""
        })
      ]);
      return;
    }

    if (type === "image") {
      yBlocks.push([
        buildYBlock({
          id,
          type,
          url: ""
        })
      ]);
      return;
    }

    yBlocks.push([
      buildYBlock({
        id,
        type,
        title: "Gráfico",
        data: buildChartSeed()
      })
    ]);
  };

  const updateBlock = (blockId: string, update: BlockUpdate) => {
    if (readOnly || !activeSlide) {
      return;
    }

    const yBlocks = getActiveSlideBlocksArray();
    if (!yBlocks) {
      return;
    }

    const index = activeSlide.blocks.findIndex((block) => block.id === blockId);
    if (index < 0) {
      return;
    }

    const yBlock = yBlocks.get(index);
    if (!(yBlock instanceof Y.Map)) {
      return;
    }

    Object.entries(update).forEach(([key, rawValue]) => {
      if (rawValue === undefined) {
        return;
      }

      if (key === "data" && Array.isArray(rawValue)) {
        yBlock.set("data", JSON.stringify(rawValue));
        return;
      }

      yBlock.set(key, rawValue);
    });
  };

  const removeBlock = (blockId: string) => {
    if (readOnly || !activeSlide) {
      return;
    }

    const yBlocks = getActiveSlideBlocksArray();
    if (!yBlocks) {
      return;
    }

    const index = activeSlide.blocks.findIndex((block) => block.id === blockId);
    if (index < 0) {
      return;
    }

    yBlocks.delete(index, 1);
  };

  const triggerImagePicker = (blockId: string) => {
    if (readOnly) {
      return;
    }

    setUploadTargetBlockId(blockId);
    uploadInputRef.current?.click();
  };

  const handleUploadImage = async (file: File | null) => {
    if (!file || !uploadTargetBlockId) {
      return;
    }

    if (!onUploadImage) {
      const manualUrl = window.prompt("URL de imagen");
      if (manualUrl) {
        updateBlock(uploadTargetBlockId, {
          url: manualUrl
        });
      }
      return;
    }

    setUploadingImage(true);
    try {
      const uploaded = await onUploadImage(file);
      if (!uploaded?.url) {
        return;
      }

      updateBlock(uploadTargetBlockId, {
        url: uploaded.url
      });
    } finally {
      setUploadingImage(false);
      setUploadTargetBlockId(null);
    }
  };

  const exportPdf = async () => {
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let index = 0; index < state.slides.length; index += 1) {
      const slide = state.slides[index]!;
      if (index > 0) {
        pdf.addPage();
      }

      const bg = hexToRgb(slide.background);
      pdf.setFillColor(bg.r, bg.g, bg.b);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      pdf.setTextColor(16, 24, 40);
      pdf.setFontSize(28);
      pdf.text(slide.title || `Diapositiva ${index + 1}`, 42, 56);

      let cursorY = 92;
      for (const block of slide.blocks) {
        if (block.type === "text") {
          pdf.setFontSize(13);
          const lines = pdf.splitTextToSize(block.content || "", pageWidth - 84);
          pdf.text(lines, 42, cursorY);
          cursorY += Math.max(40, lines.length * 16 + 10);
          continue;
        }

        if (block.type === "image" && block.url) {
          try {
            const dataUrl = await imageUrlToDataUrl(block.url);
            const imageWidth = pageWidth - 84;
            const imageHeight = Math.min(220, pageHeight - cursorY - 40);
            pdf.addImage(dataUrl, "PNG", 42, cursorY, imageWidth, imageHeight, undefined, "FAST");
            cursorY += imageHeight + 16;
          } catch {
            pdf.setFontSize(11);
            pdf.text("[No se pudo embebir imagen en PDF]", 42, cursorY);
            cursorY += 22;
          }
          continue;
        }

        if (block.type === "chart") {
          const chartTop = cursorY;
          const chartLeft = 42;
          const chartWidth = pageWidth - 84;
          const chartHeight = Math.min(190, pageHeight - cursorY - 40);

          pdf.setFontSize(12);
          pdf.text(block.title || "Gráfico", chartLeft, chartTop + 12);

          const maxValue = Math.max(1, ...block.data.map((item) => item.value));
          const barAreaTop = chartTop + 24;
          const barAreaHeight = chartHeight - 38;
          const barWidth = chartWidth / Math.max(block.data.length, 1) - 16;

          block.data.forEach((item, barIndex) => {
            const barHeight = (item.value / maxValue) * Math.max(24, barAreaHeight - 20);
            const x = chartLeft + barIndex * (barWidth + 16) + 8;
            const y = barAreaTop + (barAreaHeight - barHeight);

            pdf.setFillColor(79, 110, 247);
            pdf.rect(x, y, Math.max(8, barWidth), barHeight, "F");
            pdf.setFontSize(10);
            pdf.setTextColor(51, 65, 85);
            pdf.text(item.label, x, barAreaTop + barAreaHeight + 12, { maxWidth: barWidth + 8 });
          });

          cursorY += chartHeight + 12;
        }
      }
    }

    pdf.save(`${documentId}.pdf`);
  };

  return (
    <>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          void handleUploadImage(file);
          event.target.value = "";
        }}
      />

      <div className="grid h-full min-h-[560px] grid-cols-[240px_minmax(0,1fr)] gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={readOnly}
              onClick={addSlide}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Slide
            </button>
            <button
              type="button"
              disabled={readOnly || !activeSlide}
              onClick={duplicateSlide}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Duplicar
            </button>
            <button
              type="button"
              disabled={readOnly || !activeSlide}
              onClick={() => moveSlide(-1)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Subir
            </button>
            <button
              type="button"
              disabled={readOnly || !activeSlide}
              onClick={() => moveSlide(1)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Bajar
            </button>
            <button
              type="button"
              onClick={() => {
                const index = state.slides.findIndex((slide) => slide.id === state.activeSlideId);
                setPresentIndex(index < 0 ? 0 : index);
                setIsPresenting(true);
              }}
              className="col-span-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              Presentar
            </button>
            <button
              type="button"
              onClick={() => {
                void exportPdf();
              }}
              className="col-span-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              Exportar PDF
            </button>
            <button
              type="button"
              disabled={readOnly || state.slides.length <= 1}
              onClick={removeSlide}
              className="col-span-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Eliminar slide
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {state.slides.map((slide, index) => {
              const isActive = slide.id === state.activeSlideId;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveSlide(slide.id)}
                  className={`w-full rounded-lg border p-2 text-left text-xs ${
                    isActive
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <p className="truncate font-semibold">{index + 1}. {slide.title}</p>
                  <p className="truncate text-[11px] opacity-80">{slide.blocks.length} bloques</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="grid min-h-0 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
            {!activeSlide ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Sin diapositiva activa</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_140px]">
                  <input
                    value={activeSlide.title}
                    readOnly={readOnly}
                    onChange={(event) => updateActiveSlideMeta("title", event.target.value)}
                    className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
                  />
                  <input
                    type="color"
                    value={activeSlide.background}
                    disabled={readOnly}
                    onChange={(event) => updateActiveSlideMeta("background", event.target.value)}
                    className="h-10 rounded-lg border border-slate-200 bg-white p-1"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => addBlock("text")}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Texto
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => addBlock("image")}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Imagen
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => addBlock("chart")}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Gráfico
                  </button>
                </div>

                <div className="space-y-3">
                  {activeSlide.blocks.map((block) => {
                    if (block.type === "text") {
                      return (
                        <article key={block.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Texto</p>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => removeBlock(block.id)}
                              className="text-xs font-semibold text-red-600 disabled:opacity-40"
                            >
                              Eliminar
                            </button>
                          </div>
                          <textarea
                            value={block.content}
                            readOnly={readOnly}
                            onChange={(event) => updateBlock(block.id, { content: event.target.value })}
                            className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                          />
                        </article>
                      );
                    }

                    if (block.type === "image") {
                      return (
                        <article key={block.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imagen</p>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => removeBlock(block.id)}
                              className="text-xs font-semibold text-red-600 disabled:opacity-40"
                            >
                              Eliminar
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              value={block.url}
                              readOnly={readOnly}
                              onChange={(event) => updateBlock(block.id, { url: event.target.value })}
                              placeholder="https://..."
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                            />
                            <button
                              type="button"
                              disabled={readOnly || uploadingImage}
                              onClick={() => triggerImagePicker(block.id)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {uploadingImage && uploadTargetBlockId === block.id
                                ? "Subiendo..."
                                : "Subir imagen"}
                            </button>
                          </div>
                        </article>
                      );
                    }

                    return (
                      <article key={block.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gráfico</p>
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => removeBlock(block.id)}
                            className="text-xs font-semibold text-red-600 disabled:opacity-40"
                          >
                            Eliminar
                          </button>
                        </div>
                        <div className="space-y-2">
                          <input
                            value={block.title}
                            readOnly={readOnly}
                            onChange={(event) => updateBlock(block.id, { title: event.target.value })}
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                          />
                          <textarea
                            value={chartDataToCsv(block.data)}
                            readOnly={readOnly}
                            onChange={(event) => updateBlock(block.id, { data: chartDataFromCsv(event.target.value) })}
                            className="min-h-[110px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400"
                          />
                          <p className="text-[11px] text-slate-500">Formato: `Etiqueta,Valor` por línea</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 p-4" style={{ backgroundColor: activeSlide?.background ?? "#fff" }}>
            {activeSlide ? (
              <div className="space-y-3">
                <h3 className="text-2xl font-semibold text-slate-900">{activeSlide.title}</h3>
                {renderSlideBlocks(activeSlide)}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Sin vista previa</div>
            )}
          </div>
        </section>
      </div>

      {isPresenting && presentSlide ? (
        <div className="fixed inset-0 z-[120] flex flex-col bg-black/90 text-white">
          <header className="flex items-center justify-between px-5 py-3 text-sm">
            <span>
              Slide {presentIndex + 1}/{state.slides.length}
            </span>
            <button
              type="button"
              onClick={() => setIsPresenting(false)}
              className="rounded-lg border border-white/30 px-3 py-1 text-xs font-semibold"
            >
              Cerrar (Esc)
            </button>
          </header>

          <main className="flex min-h-0 flex-1 items-center justify-center px-6 pb-6">
            <div
              className="w-full max-w-5xl rounded-2xl p-8 shadow-2xl transition-opacity duration-300"
              style={{ backgroundColor: presentSlide.background }}
            >
              <h2 className="mb-4 text-4xl font-bold text-slate-900">{presentSlide.title}</h2>
              <div className="space-y-4">{renderSlideBlocks(presentSlide)}</div>
            </div>
          </main>

          <footer className="flex items-center justify-center gap-2 px-5 pb-4 text-xs text-white/80">
            <button
              type="button"
              onClick={() => setPresentIndex((current) => clamp(current - 1, 0, state.slides.length - 1))}
              className="rounded border border-white/30 px-3 py-1"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => setPresentIndex((current) => clamp(current + 1, 0, state.slides.length - 1))}
              className="rounded border border-white/30 px-3 py-1"
            >
              Siguiente →
            </button>
          </footer>
        </div>
      ) : null}
    </>
  );
};
