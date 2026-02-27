import type { AnnouncementContentBlock } from "@corelia/types";

const RICH_ANNOUNCEMENT_KIND = "CORELIA_ANNOUNCEMENT_V1";

type RichAnnouncementPayload = {
  kind: typeof RICH_ANNOUNCEMENT_KIND;
  version: 1;
  summary: string;
  blocks: AnnouncementContentBlock[];
  audience: {
    userIds: string[];
  };
};

type ParsedAnnouncementBody = {
  summary: string;
  blocks: AnnouncementContentBlock[];
  audienceUserIds: string[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeTextBlock = (
  type: "TITLE" | "SUBTITLE" | "TEXT",
  raw: Record<string, unknown>
): AnnouncementContentBlock | null => {
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) {
    return null;
  }
  return { type, text };
};

const normalizeImageBlock = (raw: Record<string, unknown>): AnnouncementContentBlock | null => {
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!url) {
    return null;
  }
  return {
    type: "IMAGE",
    url,
    alt: typeof raw.alt === "string" ? raw.alt : ""
  };
};

const normalizeFileBlock = (raw: Record<string, unknown>): AnnouncementContentBlock | null => {
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!label || !url) {
    return null;
  }
  return {
    type: "FILE",
    label,
    url
  };
};

const normalizeBlocks = (rawBlocks: unknown): AnnouncementContentBlock[] => {
  if (!Array.isArray(rawBlocks)) {
    return [];
  }

  const normalized: AnnouncementContentBlock[] = [];
  for (const raw of rawBlocks) {
    if (!isObject(raw) || typeof raw.type !== "string") {
      continue;
    }

    if (raw.type === "TITLE" || raw.type === "SUBTITLE" || raw.type === "TEXT") {
      const block = normalizeTextBlock(raw.type, raw);
      if (block) {
        normalized.push(block);
      }
      continue;
    }

    if (raw.type === "IMAGE") {
      const block = normalizeImageBlock(raw);
      if (block) {
        normalized.push(block);
      }
      continue;
    }

    if (raw.type === "FILE") {
      const block = normalizeFileBlock(raw);
      if (block) {
        normalized.push(block);
      }
      continue;
    }

    if (raw.type === "DIVIDER") {
      normalized.push({ type: "DIVIDER" });
    }
  }

  return normalized;
};

const normalizeUserIds = (rawUserIds: unknown): string[] => {
  if (!Array.isArray(rawUserIds)) {
    return [];
  }

  const normalized = rawUserIds
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(normalized)];
};

export const serializeAnnouncementBody = (input: {
  summary: string;
  blocks: AnnouncementContentBlock[];
  audienceUserIds: string[];
}): string => {
  const summary = input.summary.trim();
  const blocks: AnnouncementContentBlock[] =
    input.blocks.length > 0 ? input.blocks : [{ type: "TEXT", text: summary }];
  const payload: RichAnnouncementPayload = {
    kind: RICH_ANNOUNCEMENT_KIND,
    version: 1,
    summary,
    blocks,
    audience: {
      userIds: [...new Set(input.audienceUserIds)]
    }
  };

  return JSON.stringify(payload);
};

export const parseAnnouncementBody = (body: string): ParsedAnnouncementBody => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isObject(parsed) || parsed.kind !== RICH_ANNOUNCEMENT_KIND) {
      return {
        summary: body,
        blocks: [],
        audienceUserIds: []
      };
    }

    const summary = typeof parsed.summary === "string" ? parsed.summary : body;
    const blocks = normalizeBlocks(parsed.blocks);
    const audienceUserIds = normalizeUserIds(
      isObject(parsed.audience) ? parsed.audience.userIds : []
    );

    return {
      summary,
      blocks,
      audienceUserIds
    };
  } catch {
    return {
      summary: body,
      blocks: [],
      audienceUserIds: []
    };
  }
};
