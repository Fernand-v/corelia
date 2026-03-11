"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";
import { UiModal } from "@/components/ui-modal";
import { getApiBaseUrl } from "@/lib/api";

type Member = {
  id: string;
  name: string;
  color: string;
};

type ActiveCollaborator = {
  userId: string;
  name: string;
  color: string;
  cursorLabel?: string | null;
  lastSeenAt?: string;
};

type MentionSuggestionItem = {
  id: string;
  label: string;
  color: string;
};

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
const RIBBON_TABS = ["INICIO", "INSERTAR", "REVISAR"] as const;
type RibbonTab = (typeof RIBBON_TABS)[number];

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

const normalizeLinkInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    /^tel:/i.test(trimmed) ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const FontSize = Extension.create({
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
        ({ chain }: { chain: () => any }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => any }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run()
    };
  }
}) as Extension;

const ResizableImageComponent = ({ node, updateAttributes, selected }: any) => {
  const [resizing, setResizing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startWidthRef = useRef(0);
  const startHeightRef = useRef(0);
  const startLeftRef = useRef(0);
  const startTopRef = useRef(0);

  const width = node.attrs.width as number | null;
  const height = node.attrs.height as number | null;
  const align = (node.attrs.align as "left" | "center" | "right" | undefined) ?? "left";
  const freePosition = Boolean(node.attrs.freePosition);
  const x = typeof node.attrs.x === "number" ? node.attrs.x : 0;
  const y = typeof node.attrs.y === "number" ? node.attrs.y : 0;
  const zIndex = typeof node.attrs.zIndex === "number" ? node.attrs.zIndex : 10;
  const src = node.attrs.src as string;
  const alt = node.attrs.alt as string | null;
  const title = node.attrs.title as string | null;

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

const ResizableImage = Image.extend({
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

const parseContent = (value: string) => {
  if (!value.trim()) {
    return "";
  }

  try {
    return JSON.parse(value) as object;
  } catch {
    return value;
  }
};

const normalizeMentionQuery = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const initialsFromName = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return "??";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
};

const formatSeenTime = (value?: string) => {
  if (!value) {
    return "activo";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "activo";
  }
  return `activo ${date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
};

const buildMentionSuggestion = (items: MentionSuggestionItem[]) => ({
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
    let latestProps: any = null;
    let container: HTMLDivElement | null = null;

    const selectItem = (index: number) => {
      const option = latestProps?.items?.[index] as MentionSuggestionItem | undefined;
      if (!option) {
        return false;
      }

      latestProps.command({
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

      const options = (latestProps?.items ?? []) as MentionSuggestionItem[];
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
          (index === selectedIndex ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50");
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
      onStart: (props: any) => {
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
      onUpdate: (props: any) => {
        latestProps = props;
        selectedIndex = Math.max(0, Math.min(selectedIndex, (props.items?.length ?? 1) - 1));
        renderItems();
        positionContainer();
      },
      onKeyDown: (props: any) => {
        if (!latestProps?.items?.length) {
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

export const DocumentsEditorText = ({
  documentId,
  value,
  readOnly,
  provider,
  currentUser,
  members,
  activeCollaborators,
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
  members?: Member[];
  activeCollaborators?: ActiveCollaborator[];
  onUploadImage?: (file: File) => Promise<{ url: string } | null>;
  onChange: (value: string) => void;
}) => {
  const fallbackDocRef = useRef<Y.Doc | null>(null);
  if (!fallbackDocRef.current) {
    fallbackDocRef.current = new Y.Doc();
  }

  const yDoc = provider?.document ?? fallbackDocRef.current;
  const collaborationField = useMemo(() => `doc:${documentId}:text`, [documentId]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>("INICIO");
  const [imageUrlModalOpen, setImageUrlModalOpen] = useState(false);
  const [imageUrlValue, setImageUrlValue] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const apiBase = getApiBaseUrl();
  const memberList = useMemo(() => members ?? [], [members]);
  const activeCollaboratorList = useMemo(
    () => activeCollaborators ?? [],
    [activeCollaborators]
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const liveCollaborators = useMemo(() => {
    const map = new Map<string, ActiveCollaborator>();

    for (const collaborator of activeCollaboratorList) {
      if (!collaborator.userId || !collaborator.name || map.has(collaborator.userId)) {
        continue;
      }
      map.set(collaborator.userId, collaborator);
    }

    if (!map.has(currentUser.id)) {
      map.set(currentUser.id, {
        userId: currentUser.id,
        name: currentUser.name,
        color: currentUser.color,
        cursorLabel: readOnly ? "viendo" : "editando"
      });
    }

    return [...map.values()].sort((left, right) => {
      if (left.userId === currentUser.id) {
        return -1;
      }
      if (right.userId === currentUser.id) {
        return 1;
      }
      return left.name.localeCompare(right.name, "es");
    });
  }, [activeCollaboratorList, currentUser.color, currentUser.id, currentUser.name, readOnly]);

  const mentionItems = useMemo(() => {
    const map = new Map<string, MentionSuggestionItem>();
    const sourceMembers: Member[] = [
      ...memberList,
      ...liveCollaborators.map((collaborator) => ({
        id: collaborator.userId,
        name: collaborator.name,
        color: collaborator.color
      })),
      {
        id: currentUser.id,
        name: currentUser.name,
        color: currentUser.color
      }
    ];

    for (const member of sourceMembers) {
      if (!member.id || !member.name || map.has(member.id)) {
        continue;
      }
      map.set(member.id, {
        id: member.id,
        label: member.name.trim(),
        color: member.color
      });
    }

    return [...map.values()];
  }, [currentUser.color, currentUser.id, currentUser.name, liveCollaborators, memberList]);

  const liveCollaboratorIds = useMemo(
    () => new Set(liveCollaborators.map((collaborator) => collaborator.userId)),
    [liveCollaborators]
  );

  const mentionDirectory = useMemo(
    () =>
      mentionItems.filter(
        (item) => item.id !== currentUser.id && !liveCollaboratorIds.has(item.id)
      ),
    [currentUser.id, liveCollaboratorIds, mentionItems]
  );

  const mentionSuggestion = useMemo(() => buildMentionSuggestion(mentionItems), [mentionItems]);

  const extensions = useMemo(() => {
    const base = [
      StarterKit.configure({
        undoRedo: false,
        codeBlock: {
          HTMLAttributes: {
            class: "rounded-lg bg-slate-900 px-3 py-2 text-slate-100"
          }
        },
        link: false,
        underline: false
      }),
      Link.configure({
        openOnClick: true,
        autolink: true
      }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight,
      ResizableImage.configure({
        inline: false,
        allowBase64: false
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      Mention.configure({
        HTMLAttributes: {
          class:
            "rounded bg-sky-100 px-1 py-0.5 text-sky-700"
        },
        renderText({ options, node }) {
          return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion: mentionSuggestion
      }),
      Placeholder.configure({
        placeholder: "Comienza a escribir aquí..."
      }),
      Collaboration.configure({
        document: yDoc,
        field: collaborationField
      })
    ];

    if (provider?.awareness) {
      base.push(
        CollaborationCaret.configure({
          provider,
          user: {
            name: currentUser.name || "Usuario",
            color: currentUser.color
          }
        })
      );
    }

    return base;
  }, [collaborationField, currentUser.color, currentUser.name, mentionSuggestion, provider, yDoc]);

  const editor = useEditor({
    extensions,
    editable: !readOnly,
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(JSON.stringify(instance.getJSON()));
    }
  }, [extensions]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || !value.trim()) {
      return;
    }

    if (!editor.isEmpty) {
      return;
    }

    const content = parseContent(value);
    editor.commands.setContent(content);
  }, [editor, value]);

  const editorChain = () => (editor?.chain().focus() as any);

  const handleInsertImage = () => {
    if (!editor || readOnly) {
      return;
    }

    if (onUploadImage) {
      imageInputRef.current?.click();
      return;
    }

    setImageUrlValue("");
    setImageUrlModalOpen(true);
  };

  const openImageUrlModal = () => {
    if (!editor || readOnly) {
      return;
    }

    setImageUrlValue("");
    setImageUrlModalOpen(true);
  };

  const submitImageUrl = () => {
    if (!editor || readOnly) {
      return;
    }

    const resolved = resolveDocumentAssetUrl(imageUrlValue, apiBase);
    if (!resolved) {
      return;
    }

    editorChain().setImage({ src: resolved }).run();
    setImageUrlModalOpen(false);
    setImageUrlValue("");
  };

  const openLinkModal = () => {
    if (!editor || readOnly) {
      return;
    }

    setLinkValue("");
    setLinkModalOpen(true);
  };

  const submitLink = () => {
    if (!editor || readOnly) {
      return;
    }

    const normalizedLink = normalizeLinkInput(linkValue);
    if (!normalizedLink) {
      return;
    }

    editor.chain().focus().setLink({ href: normalizedLink }).run();
    setLinkModalOpen(false);
    setLinkValue("");
  };

  const handleUploadImageFile = async (file: File | null) => {
    if (!file || !editor || !onUploadImage || readOnly) {
      return;
    }

    setUploadingImage(true);
    try {
      const uploaded = await onUploadImage(file);
      if (!uploaded?.url) {
        return;
      }

      editorChain().setImage({ src: resolveDocumentAssetUrl(uploaded.url, apiBase) }).run();
    } finally {
      setUploadingImage(false);
    }
  };

  const selectedImageAttrs =
    editor && editor.isActive("image")
      ? (() => {
          const attrs = editor.getAttributes("image") as Record<string, unknown>;
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
            zIndex: typeof attrs.zIndex === "number" ? attrs.zIndex : 10
          };
        })()
      : null;

  const updateSelectedImage = useCallback(
    (attrs: Record<string, unknown>) => {
      if (!editor || readOnly || !editor.isActive("image")) {
        return;
      }
      editorChain().updateAttributes("image", attrs).run();
    },
    [editor, readOnly]
  );

  const hasTableInDoc = (() => {
    if (!editor) {
      return false;
    }
    let found = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "table") {
        found = true;
        return false;
      }
      return true;
    });
    return found;
  })();

  const focusAnyTableCell = useCallback(() => {
    if (!editor) {
      return false;
    }

    if (editor.isActive("table")) {
      return true;
    }

    let firstCellPos: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
        firstCellPos = pos + 1;
        return false;
      }
      return true;
    });

    if (firstCellPos === null) {
      return false;
    }

    return editor.chain().focus().setTextSelection(firstCellPos).run();
  }, [editor]);

  const runTableCommand = useCallback(
    (command: "addColumnAfter" | "addRowAfter" | "deleteColumn" | "deleteRow") => {
      if (!editor || readOnly) {
        return;
      }

      if (!focusAnyTableCell()) {
        return;
      }

      (editor.chain().focus() as any)[command]().run();
    },
    [editor, focusAnyTableCell, readOnly]
  );

  const deleteTableCompletely = useCallback(() => {
    if (!editor || readOnly) {
      return;
    }

    if (focusAnyTableCell()) {
      const deletedByCommand = (editor.chain().focus() as any).deleteTable().run();
      if (deletedByCommand) {
        return;
      }
    }

    let fallbackFrom = -1;
    let fallbackTo = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "table") {
        fallbackFrom = pos;
        fallbackTo = pos + node.nodeSize;
        return false;
      }
      return true;
    });

    if (fallbackFrom < 0 || fallbackTo <= fallbackFrom) {
      return;
    }

    const transaction = editor.state.tr.delete(fallbackFrom, fallbackTo);
    editor.view.dispatch(transaction);
  }, [editor, focusAnyTableCell, readOnly]);

  const tbBtn = (active: boolean) =>
    `inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors active:scale-95 ${
      active
        ? "border-[#0a84ff]/30 bg-[#0a84ff]/10 text-[#0a84ff]"
        : "border-[rgba(0,0,0,0.09)] bg-white text-slate-600 shadow-sm hover:bg-slate-50"
    }`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="word-status-bar">
        <div className="word-avatar-stack">
          {liveCollaborators.slice(0, 5).map((collaborator) => (
            <span
              key={`avatar-${collaborator.userId}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-semibold text-white"
              style={{ backgroundColor: collaborator.color }}
              title={`${collaborator.userId === currentUser.id ? "Tú" : collaborator.name} · ${collaborator.cursorLabel ?? formatSeenTime(collaborator.lastSeenAt)}`}
            >
              {initialsFromName(collaborator.name)}
            </span>
          ))}
          {liveCollaborators.length > 5 ? (
            <span className="ml-1 text-slate-500">+{liveCollaborators.length - 5}</span>
          ) : null}
        </div>
        <span className="text-slate-400">{liveCollaborators.length > 1 ? `${liveCollaborators.length} conectados` : ""}</span>
        <span className="ml-auto">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${readOnly ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {readOnly ? "Solo lectura" : "Editando"}
          </span>
        </span>
      </div>

      {!readOnly && editor ? (
        <div className="word-toolbar border-b border-[#e5e7eb] bg-[#f8fafc]">
          <div className="flex flex-wrap items-center gap-1 border-b border-[#e5e7eb] px-3 py-1.5">
            {RIBBON_TABS.map((tab) => {
              const active = activeRibbonTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveRibbonTab(tab)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    active ? "bg-white text-[#0a84ff] shadow-sm" : "text-slate-600 hover:bg-white/70"
                  }`}
                >
                  {tab === "INICIO" ? "Inicio" : tab === "INSERTAR" ? "Insertar" : "Revisar"}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            {activeRibbonTab === "INICIO" ? (
              <>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={tbBtn(editor.isActive("heading", { level: 1 }))}>H1</button>
                  <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={tbBtn(editor.isActive("heading", { level: 2 }))}>H2</button>
                  <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={tbBtn(editor.isActive("heading", { level: 3 }))}>H3</button>
                </div>

                <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={tbBtn(editor.isActive("bold"))} title="Negrita (Ctrl+B)"><strong>B</strong></button>
                  <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={tbBtn(editor.isActive("italic"))} title="Cursiva (Ctrl+I)"><em>I</em></button>
                  <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={tbBtn(editor.isActive("underline"))} title="Subrayado (Ctrl+U)"><span className="underline">U</span></button>
                  <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={tbBtn(editor.isActive("strike"))} title="Tachado"><span className="line-through">S</span></button>
                  <button type="button" onClick={() => editorChain().toggleHighlight({ color: "#fef08a" }).run()} className={tbBtn(editor.isActive("highlight"))} title="Resaltar">
                    <span className="relative">A<span className="absolute -bottom-0.5 left-0 h-1 w-full rounded bg-yellow-300" /></span>
                  </button>
                </div>

                <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

                <div className="flex items-center gap-1">
                  <div className="relative" title="Color de texto">
                    <input type="color" onChange={(event) => editorChain().setColor(event.target.value).run()} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    <span className={tbBtn(false)}>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2z"/></svg>
                    </span>
                  </div>
                  <select
                    defaultValue="16px"
                    onChange={(event) => (editor.chain().focus() as any).setFontSize(event.target.value).run()}
                    className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700 shadow-sm"
                  >
                    {FONT_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>

                <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => editorChain().setTextAlign("left").run()} className={tbBtn(editor.isActive({ textAlign: "left" }))} title="Izquierda">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                  </button>
                  <button type="button" onClick={() => editorChain().setTextAlign("center").run()} className={tbBtn(editor.isActive({ textAlign: "center" }))} title="Centrar">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                  </button>
                  <button type="button" onClick={() => editorChain().setTextAlign("right").run()} className={tbBtn(editor.isActive({ textAlign: "right" }))} title="Derecha">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
                  </button>
                </div>

                <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={tbBtn(editor.isActive("bulletList"))} title="Lista con viñetas">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
                  </button>
                  <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={tbBtn(editor.isActive("orderedList"))} title="Lista numerada">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
                  </button>
                  <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={tbBtn(editor.isActive("blockquote"))} title="Cita">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                  </button>
                  <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={tbBtn(editor.isActive("codeBlock"))} title="Bloque de código">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  </button>
                </div>
              </>
            ) : null}

            {activeRibbonTab === "INSERTAR" ? (
              <>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => editorChain().insertContent("@").run()}
                    className={tbBtn(false)}
                    title="Mencionar colaborador"
                  >
                    @
                  </button>
                  <button
                    type="button"
                    onClick={openLinkModal}
                    className={tbBtn(editor.isActive("link"))}
                    title="Insertar enlace"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleInsertImage}
                    disabled={uploadingImage}
                    className={tbBtn(false)}
                    title="Insertar imagen"
                  >
                    {uploadingImage
                      ? <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      : <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    }
                  </button>
                  <button
                    type="button"
                    onClick={openImageUrlModal}
                    className={tbBtn(false)}
                    title="Insertar imagen por URL"
                  >
                    URL
                  </button>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; void handleUploadImageFile(file); event.target.value = ""; }} />
                  <button
                    type="button"
                    onClick={() => editorChain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                    className={tbBtn(false)}
                    title="Insertar tabla"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                  </button>
                </div>

                {hasTableInDoc ? (
                  <>
                    <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => runTableCommand("addColumnAfter")} className={tbBtn(false)} title="+ Columna">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><path d="M14 12h7M17.5 8.5v7"/></svg>
                      </button>
                      <button type="button" onClick={() => runTableCommand("addRowAfter")} className={tbBtn(false)} title="+ Fila">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="7" rx="1"/><path d="M12 14v7M8.5 17.5h7"/></svg>
                      </button>
                      <button type="button" onClick={() => runTableCommand("deleteColumn")} className={tbBtn(false)} title="- Columna">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><path d="M14 12h7"/></svg>
                      </button>
                      <button type="button" onClick={() => runTableCommand("deleteRow")} className={tbBtn(false)} title="- Fila">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="7" rx="1"/><path d="M8.5 17.5h7"/></svg>
                      </button>
                      <button type="button" onClick={deleteTableCompletely} className={tbBtn(false)} title="Eliminar tabla">
                        Tabla ×
                      </button>
                    </div>
                  </>
                ) : null}

                {selectedImageAttrs ? (
                  <>
                    <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={60}
                        max={1800}
                        value={selectedImageAttrs.width ?? ""}
                        onChange={(event) => {
                          const next = Number.parseInt(event.target.value, 10);
                          updateSelectedImage({
                            width: Number.isFinite(next) ? Math.max(60, Math.min(1800, next)) : null
                          });
                        }}
                        className="h-7 w-20 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700 shadow-sm"
                        placeholder="Ancho"
                        title="Ancho (px)"
                      />
                      <input
                        type="number"
                        min={40}
                        max={1600}
                        value={selectedImageAttrs.height ?? ""}
                        onChange={(event) => {
                          const next = Number.parseInt(event.target.value, 10);
                          updateSelectedImage({
                            height: Number.isFinite(next) ? Math.max(40, Math.min(1600, next)) : null
                          });
                        }}
                        className="h-7 w-20 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700 shadow-sm"
                        placeholder="Alto"
                        title="Alto (px)"
                      />
                      <button
                        type="button"
                        onClick={() => updateSelectedImage({ width: null, height: null })}
                        className={tbBtn(false)}
                        title="Restablecer tamaño"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => updateSelectedImage({ freePosition: false, align: "left" })}
                        className={tbBtn(!selectedImageAttrs.freePosition && selectedImageAttrs.align === "left")}
                        title="Alinear izquierda"
                      >
                        Izq
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedImage({ freePosition: false, align: "center" })}
                        className={tbBtn(!selectedImageAttrs.freePosition && selectedImageAttrs.align === "center")}
                        title="Alinear centro"
                      >
                        Centro
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedImage({ freePosition: false, align: "right" })}
                        className={tbBtn(!selectedImageAttrs.freePosition && selectedImageAttrs.align === "right")}
                        title="Alinear derecha"
                      >
                        Der
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedImage({
                            freePosition: !selectedImageAttrs.freePosition,
                            zIndex: selectedImageAttrs.zIndex
                          })
                        }
                        className={tbBtn(selectedImageAttrs.freePosition)}
                        title="Mover libremente"
                      >
                        Libre
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedImage({
                            freePosition: true,
                            zIndex: Math.min(99, selectedImageAttrs.zIndex + 1)
                          })
                        }
                        className={tbBtn(false)}
                        title="Traer al frente"
                      >
                        Frente
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedImage({
                            freePosition: true,
                            zIndex: Math.max(0, selectedImageAttrs.zIndex - 1)
                          })
                        }
                        className={tbBtn(false)}
                        title="Enviar al fondo"
                      >
                        Fondo
                      </button>
                    </div>

                    {selectedImageAttrs.freePosition ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={selectedImageAttrs.x}
                          onChange={(event) => {
                            const next = Number.parseInt(event.target.value, 10);
                            updateSelectedImage({ x: Number.isFinite(next) ? next : 0 });
                          }}
                          className="h-7 w-16 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700 shadow-sm"
                          title="Posición X"
                          placeholder="X"
                        />
                        <input
                          type="number"
                          value={selectedImageAttrs.y}
                          onChange={(event) => {
                            const next = Number.parseInt(event.target.value, 10);
                            updateSelectedImage({ y: Number.isFinite(next) ? next : 0 });
                          }}
                          className="h-7 w-16 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700 shadow-sm"
                          title="Posición Y"
                          placeholder="Y"
                        />
                        <span className="text-[11px] font-medium text-slate-500">
                          Arrastra la imagen para moverla.
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            {activeRibbonTab === "REVISAR" ? (
              <>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => editor.chain().focus().undo().run()} className={tbBtn(false)} title="Deshacer (Ctrl+Z)">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                  </button>
                  <button type="button" onClick={() => editor.chain().focus().redo().run()} className={tbBtn(false)} title="Rehacer (Ctrl+Y)">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
                  </button>
                </div>
                <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />
                <div className="text-xs text-slate-500">
                  <span className="font-medium">Colaboración en vivo</span>
                  <span className="ml-1">· Usa @ para mencionar y asignar contexto</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="word-workspace flex-1 overflow-y-auto">
        <div className="word-page">
          <EditorContent
            editor={editor}
            className="prose prose-slate max-w-none text-[15px] leading-7 text-slate-800 focus:outline-none [&_.ProseMirror]:min-h-[400px] md:[&_.ProseMirror]:min-h-[900px] [&_.ProseMirror]:outline-none [&_.collaboration-cursor__label]:hidden [&_.collaboration-cursor__caret]:border-l-2 [&_.collaboration-cursor__caret]:border-l-current"
          />
        </div>
      </div>

      <UiModal
        open={imageUrlModalOpen}
        onClose={() => setImageUrlModalOpen(false)}
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
            Puedes usar una URL pública o una URL interna de archivo del módulo Documentos.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setImageUrlModalOpen(false)}
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

      <UiModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title="Insertar enlace"
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">URL del enlace</label>
          <input
            autoFocus
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitLink();
              }
            }}
            placeholder="https://... o /ruta/interna"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setLinkModalOpen(false)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submitLink}
            disabled={!linkValue.trim()}
            className="rounded-lg border border-blue-200 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Insertar
          </button>
        </div>
      </UiModal>
    </div>
  );
};
