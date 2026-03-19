import { Extension } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import type { MentionSuggestionItem } from "@/components/documents-editor-text-types";
import { normalizeMentionQuery } from "@/components/documents-editor-text-utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const fontSize = attributes.fontSize;
              if (!fontSize) {
                return {};
              }
              return {
                style: `font-size: ${String(fontSize)}`
              };
            }
          }
        }
      }
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run()
    };
  }
}) as Extension;

type ImageNodeAttributes = {
  width: number | null;
  height: number | null;
  align: "left" | "center" | "right";
  freePosition: boolean;
  x: number;
  y: number;
  zIndex: number;
  src: string;
  alt: string | null;
  title: string | null;
};

const readImageNodeAttributes = (node: NodeViewProps["node"]): ImageNodeAttributes => {
  const attrs = node.attrs as Record<string, unknown>;
  return {
    width: typeof attrs.width === "number" ? attrs.width : null,
    height: typeof attrs.height === "number" ? attrs.height : null,
    align:
      attrs.align === "center" || attrs.align === "right" || attrs.align === "left"
        ? attrs.align
        : "left",
    freePosition: Boolean(attrs.freePosition),
    x: typeof attrs.x === "number" ? attrs.x : 0,
    y: typeof attrs.y === "number" ? attrs.y : 0,
    zIndex: typeof attrs.zIndex === "number" ? attrs.zIndex : 10,
    src: typeof attrs.src === "string" ? attrs.src : "",
    alt: typeof attrs.alt === "string" ? attrs.alt : null,
    title: typeof attrs.title === "string" ? attrs.title : null
  };
};

const ResizableImageComponent = ({ node, updateAttributes, selected }: NodeViewProps) => {
  const [resizing, setResizing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startWidthRef = useRef(0);
  const startHeightRef = useRef(0);
  const startLeftRef = useRef(0);
  const startTopRef = useRef(0);

  const { width, height, align, freePosition, x, y, zIndex, src, alt, title } =
    readImageNodeAttributes(node);

  const startResize = useCallback(
    (mode: "left" | "right" | "bottom" | "corner") => (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setResizing(true);
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      startWidthRef.current = imgRef.current?.offsetWidth ?? width ?? 320;
      startHeightRef.current = imgRef.current?.offsetHeight ?? height ?? 220;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startXRef.current;
        const deltaY = moveEvent.clientY - startYRef.current;
        let nextWidth = startWidthRef.current;
        let nextHeight = startHeightRef.current;

        if (mode === "left" || mode === "right" || mode === "corner") {
          const direction = mode === "left" ? -1 : 1;
          nextWidth = Math.max(60, Math.min(1800, startWidthRef.current + deltaX * direction));
        }

        if (mode === "bottom" || mode === "corner") {
          nextHeight = Math.max(40, Math.min(1600, startHeightRef.current + deltaY));
        }

        updateAttributes({
          width: Math.round(nextWidth),
          height: Math.round(nextHeight)
        });
      };

      const onMouseUp = () => {
        setResizing(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [height, updateAttributes, width]
  );

  const startDrag = useCallback(
    (event: React.MouseEvent) => {
      if (!freePosition || !selected) {
        return;
      }
      if ((event.target as HTMLElement).closest("[data-image-handle='true']")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setDragging(true);
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      startLeftRef.current = x;
      startTopRef.current = y;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startXRef.current;
        const deltaY = moveEvent.clientY - startYRef.current;
        updateAttributes({
          x: Math.round(startLeftRef.current + deltaX),
          y: Math.round(startTopRef.current + deltaY)
        });
      };

      const onMouseUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [freePosition, selected, updateAttributes, x, y]
  );

  const wrapperStyle = freePosition
    ? {
        width: width ? `${width}px` : undefined,
        position: "absolute" as const,
        left: `${x}px`,
        top: `${y}px`,
        zIndex,
        margin: 0
      }
    : {
        width: width ? `${width}px` : undefined,
        maxWidth: "100%",
        position: "relative" as const,
        display: "block",
        marginTop: "0.5rem",
        marginBottom: "0.5rem",
        marginLeft: align === "center" || align === "right" ? "auto" : "0",
        marginRight: align === "center" ? "auto" : align === "left" ? "auto" : "0",
        zIndex: 8
      };

  const overlayVisible = selected || resizing || dragging;

  return (
    <NodeViewWrapper
      as="div"
      className={`word-image-node group ${freePosition ? "word-image-free" : ""} ${
        overlayVisible ? "ring-2 ring-blue-400 ring-offset-2 rounded" : ""
      }`}
      style={wrapperStyle}
      onMouseDown={startDrag}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt ?? undefined}
        title={title ?? undefined}
        draggable={false}
        className="block rounded shadow-sm"
        style={{
          width: width ? `${width}px` : "100%",
          height: height ? `${height}px` : "auto",
          maxWidth: freePosition ? undefined : "100%",
          cursor: freePosition ? (dragging ? "grabbing" : selected ? "grab" : "default") : "default",
          objectFit: "contain"
        }}
      />

      <div
        data-image-handle="true"
        className="absolute left-0 top-0 h-full w-2 cursor-col-resize"
        onMouseDown={startResize("left")}
      />
      <div
        data-image-handle="true"
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
        onMouseDown={startResize("right")}
      />
      <div
        data-image-handle="true"
        className="absolute bottom-0 left-0 h-2 w-full cursor-row-resize"
        onMouseDown={startResize("bottom")}
      />
      <div
        data-image-handle="true"
        className="absolute -bottom-1 -right-1 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-blue-500 shadow"
        onMouseDown={startResize("corner")}
      />

      {freePosition ? (
        <div
          data-image-handle="true"
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white"
        >
          Mover
        </div>
      ) : null}

      <span
        className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ opacity: overlayVisible ? 1 : 0 }}
      >
        {(width ?? imgRef.current?.offsetWidth ?? 0) > 0
          ? `${Math.round(width ?? imgRef.current?.offsetWidth ?? 0)} × ${Math.round(
              height ?? imgRef.current?.offsetHeight ?? 0
            )}`
          : ""}
      </span>
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const w = element.getAttribute("width") || element.style.width;
          return w ? parseInt(String(w), 10) || null : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.width) {
            return {};
          }
          return { width: String(attributes.width) };
        }
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const h = element.getAttribute("height") || element.style.height;
          return h ? parseInt(String(h), 10) || null : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.height) {
            return {};
          }
          return { height: String(attributes.height) };
        }
      },
      align: {
        default: "left",
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-align");
          return value === "center" || value === "right" ? value : "left";
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-align": String(attributes.align ?? "left")
        })
      },
      freePosition: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-free-position") === "true" ||
          element.style.position === "absolute",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-free-position": attributes.freePosition ? "true" : "false"
        })
      },
      x: {
        default: 0,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-x") ?? element.style.left;
          const value = parseInt(String(raw ?? "0"), 10);
          return Number.isFinite(value) ? value : 0;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-x": String(attributes.x ?? 0)
        })
      },
      y: {
        default: 0,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-y") ?? element.style.top;
          const value = parseInt(String(raw ?? "0"), 10);
          return Number.isFinite(value) ? value : 0;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-y": String(attributes.y ?? 0)
        })
      },
      zIndex: {
        default: 10,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-z-index") ?? element.style.zIndex;
          const value = parseInt(String(raw ?? "10"), 10);
          return Number.isFinite(value) ? value : 10;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-z-index": String(attributes.zIndex ?? 10)
        })
      }
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  }
});

type MentionCommandPayload = {
  id: string;
  label: string;
  color: string;
};

type MentionSuggestionRendererProps = {
  items: MentionSuggestionItem[];
  command: (payload: MentionCommandPayload) => void;
  clientRect?: (() => DOMRect | null) | null;
};

type MentionSuggestionKeyDownProps = {
  event: KeyboardEvent;
};

export const buildMentionSuggestion = (items: MentionSuggestionItem[]) => ({
  items: ({ query }: { query: string }) => {
    const needle = normalizeMentionQuery(query);
    if (!needle) {
      return items.slice(0, 7);
    }

    return items
      .filter((item) => normalizeMentionQuery(item.label).includes(needle))
      .slice(0, 7);
  },
  render: () => {
    let selectedIndex = 0;
    let latestProps: MentionSuggestionRendererProps | null = null;
    let container: HTMLDivElement | null = null;

    const selectItem = (index: number) => {
      const props = latestProps;
      if (!props) {
        return false;
      }

      const option = props.items[index];
      if (!option) {
        return false;
      }

      props.command({
        id: option.id,
        label: option.label,
        color: option.color
      });
      return true;
    };

    const positionContainer = () => {
      if (!container || !latestProps?.clientRect) {
        return;
      }

      const rect = latestProps.clientRect();
      if (!rect) {
        return;
      }

      container.style.left = `${rect.left + window.scrollX}px`;
      container.style.top = `${rect.bottom + window.scrollY + 8}px`;
    };

    const renderItems = () => {
      if (!container) {
        return;
      }

      const options = latestProps?.items ?? [];
      container.replaceChildren();

      if (options.length === 0) {
        container.style.display = "none";
        return;
      }

      container.style.display = "block";
      selectedIndex = Math.max(0, Math.min(selectedIndex, options.length - 1));
      const list = document.createElement("ul");
      list.className = "space-y-1";

      options.forEach((item, index) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm " +
          (index === selectedIndex
            ? "bg-slate-100 text-slate-900"
            : "text-slate-700 hover:bg-slate-50");
        button.onmousedown = (event) => {
          event.preventDefault();
          selectItem(index);
        };

        const dot = document.createElement("span");
        dot.className = "inline-flex h-2.5 w-2.5 rounded-full";
        dot.style.backgroundColor = item.color;
        const label = document.createElement("span");
        label.textContent = item.label;

        button.appendChild(dot);
        button.appendChild(label);
        li.appendChild(button);
        list.appendChild(li);
      });

      container.appendChild(list);
    };

    return {
      onStart: (props: MentionSuggestionRendererProps) => {
        latestProps = props;
        selectedIndex = 0;
        container = document.createElement("div");
        container.className =
          "z-[9999] min-w-[220px] max-w-[320px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl";
        container.style.position = "absolute";
        container.style.display = "none";
        document.body.appendChild(container);
        renderItems();
        positionContainer();
      },
      onUpdate: (props: MentionSuggestionRendererProps) => {
        latestProps = props;
        selectedIndex = Math.max(0, Math.min(selectedIndex, (props.items.length || 1) - 1));
        renderItems();
        positionContainer();
      },
      onKeyDown: (props: MentionSuggestionKeyDownProps) => {
        if (!latestProps?.items.length) {
          return false;
        }

        if (props.event.key === "ArrowDown") {
          selectedIndex = (selectedIndex + 1) % latestProps.items.length;
          renderItems();
          return true;
        }

        if (props.event.key === "ArrowUp") {
          selectedIndex = (selectedIndex + latestProps.items.length - 1) % latestProps.items.length;
          renderItems();
          return true;
        }

        if (props.event.key === "Enter" || props.event.key === "Tab") {
          props.event.preventDefault();
          return selectItem(selectedIndex);
        }

        if (props.event.key === "Escape") {
          props.event.preventDefault();
          return true;
        }

        return false;
      },
      onExit: () => {
        container?.remove();
        container = null;
      }
    };
  }
});
