// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  documentsUiPreferencesDefaults,
  readDocumentsUiPreferences,
  writeDocumentsUiPreferences
} from "@/lib/documents-ui-preferences";

describe("documents-ui-preferences", () => {
  it("usa defaults cuando no hay datos guardados", () => {
    window.localStorage.removeItem("corelia.documents.ui.preferences.v1");
    expect(readDocumentsUiPreferences()).toEqual(documentsUiPreferencesDefaults);
  });

  it("persiste y normaliza preferencias", () => {
    writeDocumentsUiPreferences({
      viewMode: "grid",
      density: "compact",
      sidebarCollapsed: true
    });

    expect(readDocumentsUiPreferences()).toEqual({
      viewMode: "grid",
      density: "compact",
      sidebarCollapsed: true
    });
  });
});
