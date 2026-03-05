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
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
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
  const onChangeRef = useRef(onChange);
  const [uploadingImage, setUploadingImage] = useState(false);
  const memberList = members ?? [];

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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

  const tbBtn = (active: boolean) =>
    `inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors active:scale-95 ${
      active
        ? "border-[#0a84ff]/30 bg-[#0a84ff]/10 text-[#0a84ff]"
        : "border-[rgba(0,0,0,0.09)] bg-white text-slate-600 shadow-sm hover:bg-slate-50"
    }`;

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">

      {!readOnly && editor ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-[rgba(0,0,0,0.07)] bg-[#f8f9fa] px-3 py-2">
          {/* Headings */}
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={tbBtn(editor.isActive("heading", { level: 1 }))}>H1</button>
            <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={tbBtn(editor.isActive("heading", { level: 2 }))}>H2</button>
            <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={tbBtn(editor.isActive("heading", { level: 3 }))}>H3</button>
          </div>

          <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

          {/* Text formatting */}
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

          {/* Color + font size */}
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

          {/* Alignment */}
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

          {/* Lists */}
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

          <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

          {/* Insert */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                const link = window.prompt("URL del enlace");
                if (!link) return;
                editor.chain().focus().setLink({ href: link }).run();
              }}
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
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; void handleUploadImageFile(file); event.target.value = ""; }} />
            <button
              type="button"
              onClick={() => editorChain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className={tbBtn(false)}
              title="Insertar tabla"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </button>
            {editor.isActive("table") ? (
              <>
                <button type="button" onClick={() => editorChain().addColumnAfter().run()} className={tbBtn(false)} title="+ Columna">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><path d="M14 12h7M17.5 8.5v7"/></svg>
                </button>
                <button type="button" onClick={() => editorChain().addRowAfter().run()} className={tbBtn(false)} title="+ Fila">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="7" rx="1"/><path d="M12 14v7M8.5 17.5h7"/></svg>
                </button>
              </>
            ) : null}
          </div>

          <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => editor.chain().focus().undo().run()} className={tbBtn(false)} title="Deshacer (Ctrl+Z)">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
            </button>
            <button type="button" onClick={() => editor.chain().focus().redo().run()} className={tbBtn(false)} title="Rehacer (Ctrl+Y)">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
            </button>
          </div>

          <div className="ml-auto text-[11px] text-slate-400">{readOnly ? "Solo lectura" : "Editando"}</div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent
          editor={editor}
          className="prose prose-slate max-w-none min-h-[400px] text-slate-800 focus:outline-none"
        />
      </div>

      {memberList.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[rgba(0,0,0,0.06)] bg-[#f8f9fa] px-4 py-2 text-[11px] text-slate-400">
          <span>Colaboradores:</span>
          {memberList.slice(0, 8).map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1 rounded-full border border-[rgba(0,0,0,0.07)] bg-white px-2 py-0.5 shadow-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: member.color }} />
              {member.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
