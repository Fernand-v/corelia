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
import { UiModal } from "@/components/ui-modal";
import { getApiBaseUrl } from "@/lib/api";

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
const DOCUMENT_ASSET_PATH_PATTERN = /^\/(?:api\/v1\/)?documents\/assets\/content\?/i;

const normalizeDocumentAssetPath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^\/documents\/assets\/content\?/i.test(trimmed)) {
    return `/api/v1${trimmed}`;
  }

  if (/^documents\/assets\/content\?/i.test(trimmed)) {
    return `/api/v1/${trimmed}`;
  }

  if (/^api\/v1\/documents\/assets\/content\?/i.test(trimmed)) {
    return `/${trimmed}`;
  }

  return trimmed;
};

const resolveDocumentAssetUrl = (value: string, apiBase: string) => {
  const normalizedValue = normalizeDocumentAssetPath(value);
  if (!normalizedValue) {
    return "";
  }

  if (/^blob:/i.test(normalizedValue) || /^data:/i.test(normalizedValue)) {
    return normalizedValue;
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    try {
      const parsed = new URL(normalizedValue);
      if (/^\/documents\/assets\/content$/i.test(parsed.pathname)) {
        parsed.pathname = `/api/v1${parsed.pathname}`;
      }
      return parsed.toString();
    } catch {
      return normalizedValue;
    }
  }

  if (!normalizedValue.startsWith("/")) {
    return normalizedValue;
  }

  if (!DOCUMENT_ASSET_PATH_PATTERN.test(normalizedValue)) {
    return normalizedValue;
  }

  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    const apiOrigin = apiBase.replace(/\/api\/v1\/?$/i, "");
    return `${apiOrigin}${normalizedValue}`;
  }

  return normalizedValue;
};

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

const renderSlideBlocks = (
  slide: Slide,
  resolveImageUrl: (value: string) => string
) => {
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
        // eslint-disable-next-line @next/next/no-img-element -- Editor uses blob/data URLs and remote slide assets that are not compatible with next/image optimization.
        <img
          key={block.id}
          src={resolveImageUrl(block.url)}
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
  const [urlTargetBlockId, setUrlTargetBlockId] = useState<string | null>(null);
  const [imageUrlModalOpen, setImageUrlModalOpen] = useState(false);
  const [imageUrlValue, setImageUrlValue] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [slideTransition, setSlideTransition] = useState<"none" | "entering">("none");
  const apiBase = getApiBaseUrl();

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const lastSerializedRef = useRef("");
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSlide = state.slides.find((slide) => slide.id === state.activeSlideId) ?? state.slides[0] ?? null;
  const presentSlide = state.slides[presentIndex] ?? state.slides[0] ?? null;
  const selectedBlock = activeSlide?.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const resolveImageUrl = useCallback(
    (value: string) => resolveDocumentAssetUrl(value, apiBase),
    [apiBase]
  );

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

  useEffect(() => {
    setSelectedBlockId(null);
  }, [state.activeSlideId]);

  useEffect(() => {
    if (!isPresenting) {
      setCursorHidden(false);
      return;
    }

    const resetTimer = () => {
      setCursorHidden(false);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = setTimeout(() => setCursorHidden(true), 3000);
    };

    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, [isPresenting]);

  const goToSlide = useCallback(
    (nextIndex: number) => {
      const clamped = clamp(nextIndex, 0, state.slides.length - 1);
      if (clamped === presentIndex) return;
      setSlideTransition("entering");
      setPresentIndex(clamped);
      setTimeout(() => setSlideTransition("none"), 300);
    },
    [presentIndex, state.slides.length]
  );

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

    if (!onUploadImage) {
      const currentBlock = activeSlide?.blocks.find(
        (block): block is ImageBlock => block.id === blockId && block.type === "image"
      );
      setUrlTargetBlockId(blockId);
      setImageUrlValue(currentBlock?.url ?? "");
      setImageUrlModalOpen(true);
      return;
    }

    setUploadTargetBlockId(blockId);
    uploadInputRef.current?.click();
  };

  const openImageUrlModal = (blockId: string, currentUrl = "") => {
    if (readOnly) {
      return;
    }

    setUrlTargetBlockId(blockId);
    setImageUrlValue(currentUrl);
    setImageUrlModalOpen(true);
  };

  const submitImageUrl = () => {
    if (readOnly || !urlTargetBlockId) {
      return;
    }

    const nextValue = normalizeDocumentAssetPath(imageUrlValue);
    if (!nextValue) {
      return;
    }

    updateBlock(urlTargetBlockId, { url: nextValue });
    setImageUrlModalOpen(false);
    setImageUrlValue("");
    setUrlTargetBlockId(null);
  };

  const handleUploadImage = async (file: File | null) => {
    if (!file || !uploadTargetBlockId) {
      return;
    }

    if (!onUploadImage) {
      openImageUrlModal(uploadTargetBlockId);
      setUploadTargetBlockId(null);
      return;
    }

    setUploadingImage(true);
    try {
      const uploaded = await onUploadImage(file);
      if (!uploaded?.url) {
        return;
      }

      updateBlock(uploadTargetBlockId, {
        url: normalizeDocumentAssetPath(uploaded.url)
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
            const dataUrl = await imageUrlToDataUrl(resolveImageUrl(block.url));
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

  const renderCanvasBlock = (block: SlideBlock) => {
    const isSelected = block.id === selectedBlockId;

    const wrapperClasses = [
      "pres-block relative rounded-lg p-3 cursor-pointer",
      isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""
    ].join(" ");

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedBlockId(block.id);
      setRightPanelOpen(true);
    };

    if (block.type === "text") {
      return (
        <div key={block.id} className={wrapperClasses} onClick={handleClick}>
          {isSelected && !readOnly && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeBlock(block.id); setSelectedBlockId(null); }}
              className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow"
            >
              ✕
            </button>
          )}
          <p className="whitespace-pre-wrap text-base text-slate-700">
            {block.content || <span className="italic text-slate-400">Haz clic para editar texto...</span>}
          </p>
        </div>
      );
    }

    if (block.type === "image") {
      return (
        <div key={block.id} className={wrapperClasses} onClick={handleClick}>
          {isSelected && !readOnly && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeBlock(block.id); setSelectedBlockId(null); }}
              className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow"
            >
              ✕
            </button>
          )}
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- Editor uses blob/data URLs and remote slide assets that are not compatible with next/image optimization.
            <img
              src={resolveImageUrl(block.url)}
              alt="Imagen de diapositiva"
              className="max-h-[280px] w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
              Sin imagen - selecciona para agregar
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={block.id} className={wrapperClasses} onClick={handleClick}>
        {isSelected && !readOnly && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeBlock(block.id); setSelectedBlockId(null); }}
            className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow"
          >
            ✕
          </button>
        )}
        <p className="mb-1 text-sm font-semibold text-slate-700">{block.title}</p>
        <div className="h-[180px]">
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
      </div>
    );
  };

  const activeSlideIndex = state.slides.findIndex((s) => s.id === state.activeSlideId);

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

      <div className="flex h-full min-h-[560px] flex-col rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
        {/* Toolbar ribbon */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5 rounded-t-2xl">
          <div className="flex items-center gap-1">
            <button type="button" disabled={readOnly} onClick={addSlide} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">+ Slide</button>
            <button type="button" disabled={readOnly || !activeSlide} onClick={duplicateSlide} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Duplicar</button>
            <button type="button" disabled={readOnly || state.slides.length <= 1} onClick={removeSlide} className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Eliminar</button>
            <button type="button" disabled={readOnly || !activeSlide} onClick={() => moveSlide(-1)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">↑</button>
            <button type="button" disabled={readOnly || !activeSlide} onClick={() => moveSlide(1)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">↓</button>
          </div>

          <div className="mx-2 h-5 w-px bg-slate-200" />

          <div className="flex items-center gap-1">
            <button type="button" disabled={readOnly} onClick={() => addBlock("text")} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">+ Texto</button>
            <button type="button" disabled={readOnly} onClick={() => addBlock("image")} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">+ Imagen</button>
            <button type="button" disabled={readOnly} onClick={() => addBlock("chart")} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">+ Gráfico</button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const index = state.slides.findIndex((slide) => slide.id === state.activeSlideId);
                setPresentIndex(index < 0 ? 0 : index);
                setIsPresenting(true);
              }}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              Presentar
            </button>
            <button type="button" onClick={() => { void exportPdf(); }} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">PDF</button>
          </div>
        </div>

        {/* Main area: thumbnails + canvas + properties */}
        <div className="flex min-h-0 flex-1">
          {/* Thumbnails panel */}
          <aside className="flex w-[200px] min-w-[200px] flex-col border-r border-slate-200 bg-white/80 p-2 overflow-y-auto">
            <div className="space-y-2">
              {state.slides.map((slide, index) => {
                const isActive = slide.id === state.activeSlideId;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveSlide(slide.id)}
                    className={`group relative w-full rounded-lg border-2 p-1 text-left transition-all ${
                      isActive
                        ? "border-blue-500 shadow-md"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className="aspect-video w-full rounded overflow-hidden"
                      style={{ backgroundColor: slide.background }}
                    >
                      <div className="flex h-full flex-col justify-center px-2">
                        <p className="truncate text-[8px] font-bold text-slate-800 leading-tight">{slide.title}</p>
                        <div className="mt-0.5 flex gap-0.5">
                          {slide.blocks.map((b) => (
                            <span key={b.id} className="inline-flex h-3 w-3 items-center justify-center rounded-sm bg-black/10 text-[6px] font-bold text-slate-600">
                              {b.type === "text" ? "T" : b.type === "image" ? "I" : "G"}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded bg-black/40 text-[8px] font-bold text-white">
                      {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Canvas central */}
          <main
            className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-6"
            onClick={() => { setSelectedBlockId(null); }}
          >
            {!activeSlide ? (
              <div className="text-sm text-slate-500">Sin diapositiva activa</div>
            ) : (
              <div
                className="pres-canvas-slide aspect-video w-full max-w-4xl rounded-xl overflow-hidden"
                style={{ backgroundColor: activeSlide.background }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSelectedBlockId(null);
                }}
              >
                <div className="flex h-full flex-col p-8">
                  <h3 className="mb-4 text-2xl font-bold text-slate-900">{activeSlide.title}</h3>
                  <div className="flex-1 space-y-3 overflow-y-auto">
                    {activeSlide.blocks.map((block) => renderCanvasBlock(block))}
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Properties panel */}
          {rightPanelOpen && activeSlide && (
            <aside className="flex w-[280px] min-w-[280px] flex-col border-l border-slate-200 bg-white overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  {selectedBlock ? "Propiedades" : "Diapositiva"}
                </p>
                <button
                  type="button"
                  onClick={() => { setRightPanelOpen(false); setSelectedBlockId(null); }}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 p-3">
                {/* Slide properties - always visible */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Título</label>
                  <input
                    value={activeSlide.title}
                    readOnly={readOnly}
                    onChange={(e) => updateActiveSlideMeta("title", e.target.value)}
                    className="h-8 w-full rounded-md border border-slate-200 px-2 text-sm text-slate-800 outline-none focus:border-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fondo</label>
                  <input
                    type="color"
                    value={activeSlide.background}
                    disabled={readOnly}
                    onChange={(e) => updateActiveSlideMeta("background", e.target.value)}
                    className="h-8 w-full rounded-md border border-slate-200 bg-white p-0.5"
                  />
                </div>

                {/* Block properties - conditional */}
                {selectedBlock && (
                  <>
                    <div className="border-t border-slate-200 pt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Bloque: {selectedBlock.type === "text" ? "Texto" : selectedBlock.type === "image" ? "Imagen" : "Gráfico"}
                      </p>
                    </div>

                    {selectedBlock.type === "text" && (
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Contenido</label>
                        <textarea
                          value={selectedBlock.content}
                          readOnly={readOnly}
                          onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                          className="min-h-[120px] w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                        />
                      </div>
                    )}

                    {selectedBlock.type === "image" && (
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">URL de imagen</label>
                        <input
                          value={selectedBlock.url}
                          readOnly={readOnly}
                          onChange={(e) => updateBlock(selectedBlock.id, { url: e.target.value })}
                          placeholder="https://... o /api/v1/documents/assets/content?token=..."
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                        />
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => openImageUrlModal(selectedBlock.id, selectedBlock.url)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Usar URL
                        </button>
                        <button
                          type="button"
                          disabled={readOnly || uploadingImage}
                          onClick={() => triggerImagePicker(selectedBlock.id)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {uploadingImage && uploadTargetBlockId === selectedBlock.id ? "Subiendo..." : "Subir imagen"}
                        </button>
                      </div>
                    )}

                    {selectedBlock.type === "chart" && (
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Título del gráfico</label>
                        <input
                          value={selectedBlock.title}
                          readOnly={readOnly}
                          onChange={(e) => updateBlock(selectedBlock.id, { title: e.target.value })}
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                        />
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Datos (Etiqueta,Valor)</label>
                        <textarea
                          value={chartDataToCsv(selectedBlock.data)}
                          readOnly={readOnly}
                          onChange={(e) => updateBlock(selectedBlock.id, { data: chartDataFromCsv(e.target.value) })}
                          className="min-h-[100px] w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400"
                        />
                      </div>
                    )}

                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => { removeBlock(selectedBlock.id); setSelectedBlockId(null); }}
                        className="w-full rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Eliminar bloque
                      </button>
                    )}
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Presentation mode */}
      {isPresenting && presentSlide ? (
        <div
          className={`fixed inset-0 z-[120] flex flex-col bg-black text-white ${cursorHidden ? "pres-cursor-none" : ""}`}
          onClick={() => goToSlide(presentIndex + 1)}
        >
          <main className="flex min-h-0 flex-1 items-center justify-center">
            <div
              className={`pres-fullslide aspect-video w-[90vw] max-w-6xl rounded-xl shadow-2xl overflow-hidden ${
                slideTransition === "entering" ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100"
              }`}
              style={{ backgroundColor: presentSlide.background }}
            >
              <div className="flex h-full flex-col p-10">
                <h2 className="mb-6 text-4xl font-bold text-slate-900">{presentSlide.title}</h2>
                <div className="flex-1 space-y-4 overflow-hidden">
                  {renderSlideBlocks(presentSlide, resolveImageUrl)}
                </div>
              </div>
            </div>
          </main>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full bg-blue-400 transition-all duration-300"
              style={{ width: `${((presentIndex + 1) / state.slides.length) * 100}%` }}
            />
          </div>

          {/* Controls overlay */}
          <div className={`absolute inset-x-0 bottom-4 flex items-center justify-center gap-3 transition-opacity duration-300 ${cursorHidden ? "opacity-0" : "opacity-100"}`}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goToSlide(presentIndex - 1); }}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm hover:bg-white/20"
            >
              ←
            </button>

            <div className="flex items-center gap-1.5">
              {state.slides.map((_, i) => (
                <button
                  key={state.slides[i]!.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goToSlide(i); }}
                  className={`rounded-full transition-all ${
                    i === presentIndex
                      ? "h-2.5 w-2.5 bg-white"
                      : "h-1.5 w-1.5 bg-white/50 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goToSlide(presentIndex + 1); }}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm hover:bg-white/20"
            >
              →
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsPresenting(false); }}
              className="ml-2 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm hover:bg-white/20"
            >
              ESC
            </button>
          </div>
        </div>
      ) : null}

      <UiModal
        open={imageUrlModalOpen}
        onClose={() => {
          setImageUrlModalOpen(false);
          setUrlTargetBlockId(null);
        }}
        title="Insertar imagen por URL"
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">URL de imagen</label>
          <input
            autoFocus
            value={imageUrlValue}
            onChange={(event) => setImageUrlValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitImageUrl();
              }
            }}
            placeholder="https://... o /api/v1/documents/assets/content?token=..."
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
          />
          <p className="text-xs text-slate-500">
            Puedes pegar una URL externa o una URL interna de archivo del módulo Documentos.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setImageUrlModalOpen(false);
              setUrlTargetBlockId(null);
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submitImageUrl}
            disabled={!imageUrlValue.trim()}
            className="rounded-lg border border-blue-200 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Insertar
          </button>
        </div>
      </UiModal>
    </>
  );
};
