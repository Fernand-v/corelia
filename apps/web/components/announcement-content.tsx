"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnnouncementContentBlock } from "@corelia/types";
import { getApiBaseUrl } from "@/lib/api";
import {
  resolveAnnouncementImageCandidates,
  resolveAnnouncementUrl,
} from "@/components/announcement-content-state";

const AnnouncementImage = ({
  candidates,
  alt,
}: {
  candidates: string[];
  alt: string;
}) => {
  const candidatesKey = candidates.join("||");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setFailed(false);
  }, [candidatesKey]);

  const currentUrl = candidates[candidateIndex] ?? null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
      style={{ minHeight: "160px" }}
    >
      {!currentUrl || failed ? (
        <div className="flex h-40 w-full items-center justify-center gap-2 text-slate-400">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-6"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="text-xs">Imagen no disponible</span>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={currentUrl}
          alt={alt}
          className="max-h-96 w-full object-contain"
          onError={() => {
            setCandidateIndex((current) => {
              if (current + 1 < candidates.length) {
                return current + 1;
              }
              setFailed(true);
              return current;
            });
          }}
        />
      )}
    </div>
  );
};

export const AnnouncementContent = ({
  blocks,
  fallbackBody,
  compact = false,
}: {
  blocks?: AnnouncementContentBlock[] | undefined;
  fallbackBody?: string;
  compact?: boolean;
}) => {
  const apiBase = useMemo(() => getApiBaseUrl(), []);

  if (!blocks || blocks.length === 0) {
    if (!fallbackBody) {
      return null;
    }
    return (
      <p
        className={
          compact ? "text-sm text-slate-700" : "text-sm text-slate-700"
        }
      >
        {fallbackBody}
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {blocks.map((block, index) => {
        if (block.type === "TITLE") {
          return (
            <h3
              key={`block-${index}`}
              className="text-xl font-bold text-slate-900"
            >
              {block.text}
            </h3>
          );
        }

        if (block.type === "SUBTITLE") {
          return (
            <h4
              key={`block-${index}`}
              className="text-base font-semibold text-slate-800"
            >
              {block.text}
            </h4>
          );
        }

        if (block.type === "TEXT") {
          return (
            <p
              key={`block-${index}`}
              className="whitespace-pre-wrap text-sm leading-6 text-slate-700"
            >
              {block.text}
            </p>
          );
        }

        if (block.type === "IMAGE") {
          const candidates = resolveAnnouncementImageCandidates({
            value: block.url,
            apiBase,
          });
          if (candidates.length === 0) {
            return null;
          }

          return (
            <figure key={`block-${index}`} className="space-y-1">
              <AnnouncementImage
                candidates={candidates}
                alt={block.alt || "Imagen del anuncio"}
              />
              {block.alt ? (
                <figcaption className="text-xs text-slate-500">
                  {block.alt}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (block.type === "FILE") {
          const resolvedUrl = resolveAnnouncementUrl({
            value: block.url,
            apiBase,
            kind: "FILE",
          });
          if (!resolvedUrl) {
            return null;
          }

          return (
            <a
              key={`block-${index}`}
              href={resolvedUrl}
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
