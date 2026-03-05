import type { DiagramKind } from "@corelia/types";

import type { ShapeLibrary } from "@/lib/diagram/maxgraph/palette-catalog";

const CACHE_KEY = "corelia.maxgraph.remote-libraries.v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

type RemoteShapeLibraryPayload = ShapeLibrary & {
  diagramKinds?: DiagramKind[];
};

type RemoteStencilIndex = {
  version?: string;
  libraries: RemoteShapeLibraryPayload[];
};

const parseCachedLibraries = (kind: DiagramKind): ShapeLibrary[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(CACHE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as {
      timestamp: number;
      libraries: RemoteShapeLibraryPayload[];
    };

    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return [];
    }

    return (parsed.libraries ?? []).filter(
      (library) => !library.diagramKinds || library.diagramKinds.includes(kind)
    );
  } catch {
    return [];
  }
};

const cacheLibraries = (libraries: RemoteShapeLibraryPayload[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      timestamp: Date.now(),
      libraries
    })
  );
};

export const loadRemoteStencilLibraries = async (
  kind: DiagramKind,
  signal?: AbortSignal
): Promise<ShapeLibrary[]> => {
  const indexUrl = process.env.NEXT_PUBLIC_MAXGRAPH_STENCIL_INDEX_URL;
  if (!indexUrl) {
    return [];
  }

  const cached = parseCachedLibraries(kind);
  if (cached.length > 0) {
    return cached;
  }

  try {
    const response = await fetch(indexUrl, signal ? { signal } : undefined);
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as RemoteStencilIndex;
    const libraries = Array.isArray(payload.libraries) ? payload.libraries : [];

    cacheLibraries(libraries);

    return libraries.filter((library) => !library.diagramKinds || library.diagramKinds.includes(kind));
  } catch {
    return [];
  }
};
