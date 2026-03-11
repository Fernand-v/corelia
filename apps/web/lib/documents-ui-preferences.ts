export type DocumentsExplorerViewMode = "list" | "grid";
export type DocumentsExplorerDensity = "comfortable" | "compact";

export type DocumentsUiPreferences = {
  viewMode: DocumentsExplorerViewMode;
  density: DocumentsExplorerDensity;
  sidebarCollapsed: boolean;
};

const STORAGE_KEY = "corelia.documents.ui.preferences.v1";

const DEFAULT_PREFERENCES: DocumentsUiPreferences = {
  viewMode: "list",
  density: "comfortable",
  sidebarCollapsed: false
};

const normalizeViewMode = (value: unknown): DocumentsExplorerViewMode => {
  return value === "grid" ? "grid" : "list";
};

const normalizeDensity = (value: unknown): DocumentsExplorerDensity => {
  return value === "compact" ? "compact" : "comfortable";
};

export const readDocumentsUiPreferences = (): DocumentsUiPreferences => {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = JSON.parse(raw) as Partial<DocumentsUiPreferences>;
    return {
      viewMode: normalizeViewMode(parsed.viewMode),
      density: normalizeDensity(parsed.density),
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed)
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

export const writeDocumentsUiPreferences = (
  preferences: DocumentsUiPreferences
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      viewMode: normalizeViewMode(preferences.viewMode),
      density: normalizeDensity(preferences.density),
      sidebarCollapsed: Boolean(preferences.sidebarCollapsed)
    })
  );
};

export const documentsUiPreferencesDefaults = DEFAULT_PREFERENCES;
