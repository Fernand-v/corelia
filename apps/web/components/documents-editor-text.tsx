"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";

type Member = {
  id: string;
  name: string;
  color: string;
};

type MentionSuggestionItem = {
  id: string;
  label: string;
  color: string;
};

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

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
  const [uploadingImage, setUploadingImage] = useState(false);
  const memberList = members ?? [];

  const mentionItems = useMemo(() => {
    const map = new Map<string, MentionSuggestionItem>();
    const sourceMembers: Member[] = [
      ...memberList,
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
  }, [currentUser.color, currentUser.id, currentUser.name, memberList]);

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
        link: {
          openOnClick: true,
          autolink: true
        }
      }),
      TextStyle,
      FontSize,
      Color,
      Highlight,
      Image.configure({
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
      onChange(JSON.stringify(instance.getJSON()));
    }
  });

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

    const imageUrl = window.prompt("URL de imagen");
    if (!imageUrl) {
      return;
    }
    editorChain().setImage({ src: imageUrl }).run();
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

      editorChain().setImage({ src: uploaded.url }).run();
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs text-slate-500">
        <span>Editor de texto colaborativo (Tiptap + Y.js)</span>
        <span>{readOnly ? "Lectura" : "Edición"}</span>
      </div>

      {!readOnly && editor ? (
        <div className="space-y-2 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold italic text-slate-600"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold underline text-slate-600"
            >
              U
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold line-through text-slate-600"
            >
              S
            </button>
            <button
              type="button"
              onClick={() => editorChain().toggleHighlight({ color: "#fef08a" }).run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Resaltar
            </button>

            <select
              defaultValue="16px"
              onChange={(event) =>
                (editor.chain().focus() as any).setFontSize(event.target.value).run()
              }
              className="h-7 rounded-lg border border-slate-200 px-2 text-xs text-slate-700"
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <input
              type="color"
              title="Color de texto"
              onChange={(event) => editorChain().setColor(event.target.value).run()}
              className="h-7 w-9 rounded border border-slate-200 bg-white p-1"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Numerada
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Cita
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Código
            </button>

            <button
              type="button"
              onClick={() => editorChain().setTextAlign("left").run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Izq
            </button>
            <button
              type="button"
              onClick={() => editorChain().setTextAlign("center").run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Centro
            </button>
            <button
              type="button"
              onClick={() => editorChain().setTextAlign("right").run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Der
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const link = window.prompt("URL del enlace");
                if (!link) {
                  return;
                }
                editor.chain().focus().setLink({ href: link }).run();
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Enlace
            </button>
            <button
              type="button"
              onClick={handleInsertImage}
              disabled={uploadingImage}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              {uploadingImage ? "Subiendo..." : "Imagen"}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleUploadImageFile(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() =>
                editorChain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Tabla
            </button>
            <button
              type="button"
              onClick={() => editorChain().addColumnAfter().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              + Columna
            </button>
            <button
              type="button"
              onClick={() => editorChain().addRowAfter().run()}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              + Fila
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-[460px] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        <EditorContent editor={editor} className="prose prose-slate max-w-none" />
      </div>

      {memberList.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Colaboradores del proyecto:</span>
          {memberList.slice(0, 8).map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: member.color }} />
              {member.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
