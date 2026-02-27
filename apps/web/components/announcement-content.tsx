"use client";

import type { AnnouncementContentBlock } from "@corelia/types";

const isSafeHttpUrl = (value: string) => /^https?:\/\//i.test(value);

export const AnnouncementContent = ({
  blocks,
  fallbackBody,
  compact = false
}: {
  blocks?: AnnouncementContentBlock[] | undefined;
  fallbackBody?: string;
  compact?: boolean;
}) => {
  if (!blocks || blocks.length === 0) {
    if (!fallbackBody) {
      return null;
    }
    return <p className={compact ? "text-sm text-slate-700" : "text-sm text-slate-700"}>{fallbackBody}</p>;
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {blocks.map((block, index) => {
        if (block.type === "TITLE") {
          return (
            <h3 key={`block-${index}`} className="text-xl font-bold text-slate-900">
              {block.text}
            </h3>
          );
        }

        if (block.type === "SUBTITLE") {
          return (
            <h4 key={`block-${index}`} className="text-base font-semibold text-slate-800">
              {block.text}
            </h4>
          );
        }

        if (block.type === "TEXT") {
          return (
            <p key={`block-${index}`} className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {block.text}
            </p>
          );
        }

        if (block.type === "IMAGE") {
          if (!isSafeHttpUrl(block.url)) {
            return null;
          }

          return (
            <figure key={`block-${index}`} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.url}
                alt={block.alt || "Imagen del anuncio"}
                className="max-h-96 w-full rounded-xl border border-slate-200 object-contain"
              />
              {block.alt ? <figcaption className="text-xs text-slate-500">{block.alt}</figcaption> : null}
            </figure>
          );
        }

        if (block.type === "FILE") {
          if (!isSafeHttpUrl(block.url)) {
            return null;
          }

          return (
            <a
              key={`block-${index}`}
              href={block.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Adjuntar: {block.label}
            </a>
          );
        }

        return <hr key={`block-${index}`} className="border-slate-200" />;
      })}
    </div>
  );
};
