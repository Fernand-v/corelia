import { describe, expect, it } from "vitest";

import { createEmptyDrawioDocument } from "@/lib/diagram/maxgraph/xml-format";
import {
  addPage,
  duplicatePage,
  getActivePage,
  removePage,
  renamePage,
  setActivePage,
  updatePageXml
} from "@/lib/diagram/maxgraph/xml-pages";

describe("maxgraph xml pages", () => {
  it("adds, renames, duplicates and removes pages while keeping active page valid", () => {
    const base = createEmptyDrawioDocument("FLUJO");
    const firstPageId = base.pages[0]?.id;
    expect(firstPageId).toBeTruthy();

    const withSecond = addPage(base, {
      name: "Segunda",
      xml: '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>'
    });
    expect(withSecond.pages).toHaveLength(2);
    expect(withSecond.activePageId).toBe(withSecond.pages[1]?.id);

    const renamed = renamePage(withSecond, withSecond.activePageId, "Página Renombrada");
    expect(getActivePage(renamed)?.name).toBe("Página Renombrada");

    const duplicated = duplicatePage(renamed, renamed.activePageId);
    expect(duplicated.pages).toHaveLength(3);
    expect(getActivePage(duplicated)?.name).toContain("(copia)");

    const updatedXml = updatePageXml(duplicated, duplicated.activePageId, "<mxGraphModel><root/></mxGraphModel>");
    expect(getActivePage(updatedXml)?.xml).toContain("<mxGraphModel>");

    const switched = setActivePage(updatedXml, firstPageId ?? "");
    expect(switched.activePageId).toBe(firstPageId);

    const removed = removePage(switched, firstPageId ?? "");
    expect(removed.pages).toHaveLength(2);
    expect(removed.pages.some((page) => page.id === firstPageId)).toBe(false);
    expect(removed.pages.some((page) => page.id === removed.activePageId)).toBe(true);
  });

  it("does not remove the only page", () => {
    const base = createEmptyDrawioDocument("BPMN");
    const onlyPageId = base.pages[0]?.id ?? "";

    const next = removePage(base, onlyPageId);
    expect(next.pages).toHaveLength(1);
    expect(next.activePageId).toBe(onlyPageId);
  });
});
