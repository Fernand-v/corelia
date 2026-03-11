import { describe, expect, it } from "vitest";

import type { DrawioDocument } from "@/lib/diagram/maxgraph/xml-format";
import { mergeDrawioDocuments } from "@/lib/diagram/maxgraph/xml-collab-merge";

const wrapGraphModel = (innerCells: string): string =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${innerCells}</root></mxGraphModel>`;

const baseDocument = (xml: string): DrawioDocument => ({
  host: "corelia",
  etag: "etag-1",
  modified: "2026-03-10T00:00:00.000Z",
  activePageId: "page-1",
  pages: [
    {
      id: "page-1",
      name: "Flujo",
      xml
    }
  ]
});

describe("maxgraph collaborative xml merge", () => {
  it("preserves concurrent inserts with different ids", () => {
    const local = baseDocument(
      wrapGraphModel(
        '<mxCell id="a-1" value="A" vertex="1" parent="1"><mxGeometry x="10" y="20" width="120" height="60" as="geometry"/></mxCell>'
      )
    );
    const incoming = baseDocument(
      wrapGraphModel(
        '<mxCell id="b-1" value="B" vertex="1" parent="1"><mxGeometry x="220" y="20" width="120" height="60" as="geometry"/></mxCell>'
      )
    );

    const merged = mergeDrawioDocuments(local, incoming, "incoming");
    const pageXml = merged.pages[0]?.xml ?? "";

    expect(pageXml).toContain('id="a-1"');
    expect(pageXml).toContain('id="b-1"');
  });

  it("keeps incoming page order when page set is equal", () => {
    const local: DrawioDocument = {
      host: "corelia",
      etag: "etag-local",
      modified: "2026-03-10T00:00:00.000Z",
      activePageId: "p-2",
      pages: [
        { id: "p-1", name: "Uno", xml: wrapGraphModel("") },
        { id: "p-2", name: "Dos", xml: wrapGraphModel("") }
      ]
    };
    const incoming: DrawioDocument = {
      host: "corelia",
      etag: "etag-remote",
      modified: "2026-03-10T00:00:01.000Z",
      activePageId: "p-1",
      pages: [
        { id: "p-2", name: "Dos", xml: wrapGraphModel("") },
        { id: "p-1", name: "Uno", xml: wrapGraphModel("") }
      ]
    };

    const merged = mergeDrawioDocuments(local, incoming, "incoming");

    expect(merged.pages.map((page) => page.id)).toEqual(["p-2", "p-1"]);
    expect(merged.activePageId).toBe("p-1");
  });

  it("falls back to deterministic order when page sets diverge", () => {
    const local: DrawioDocument = {
      host: "corelia",
      activePageId: "p-10",
      pages: [
        { id: "p-10", name: "Local", xml: wrapGraphModel("") },
        { id: "p-2", name: "Base", xml: wrapGraphModel("") }
      ]
    };
    const incoming: DrawioDocument = {
      host: "corelia",
      activePageId: "p-2",
      pages: [
        { id: "p-2", name: "Base", xml: wrapGraphModel("") },
        { id: "p-3", name: "Remote", xml: wrapGraphModel("") }
      ]
    };

    const merged = mergeDrawioDocuments(local, incoming, "incoming");

    expect(merged.pages.map((page) => page.id)).toEqual(["p-2", "p-3"]);
  });

  it("does not create duplicate pages when both sides have one page with different ids", () => {
    const local: DrawioDocument = {
      host: "corelia",
      activePageId: "local-1",
      pages: [{ id: "local-1", name: "Local", xml: wrapGraphModel('<mxCell id="a-1" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>') }]
    };
    const incoming: DrawioDocument = {
      host: "corelia",
      activePageId: "remote-1",
      pages: [{ id: "remote-1", name: "Remote", xml: wrapGraphModel('<mxCell id="b-1" vertex="1" parent="1"><mxGeometry x="120" y="10" width="80" height="40" as="geometry"/></mxCell>') }]
    };

    const merged = mergeDrawioDocuments(local, incoming, "incoming");

    expect(merged.pages).toHaveLength(1);
    expect(merged.pages[0]?.id).toBe("remote-1");
    expect(merged.pages[0]?.xml).toContain('id="a-1"');
    expect(merged.pages[0]?.xml).toContain('id="b-1"');
  });

  it("keeps incoming-only pages when local is shorter with incoming preference", () => {
    const local: DrawioDocument = {
      activePageId: "p-1",
      pages: [{ id: "p-1", name: "One", xml: wrapGraphModel("") }]
    };
    const incoming: DrawioDocument = {
      activePageId: "p-2",
      pages: [
        { id: "p-1", name: "One", xml: wrapGraphModel("") },
        { id: "p-2", name: "Two", xml: wrapGraphModel("") }
      ]
    };

    const merged = mergeDrawioDocuments(local, incoming, "incoming");
    expect(merged.pages.map((page) => page.id)).toEqual(["p-1", "p-2"]);
  });

  it("respects merge preference for conflicting cell ids", () => {
    const local = baseDocument(
      wrapGraphModel(
        '<mxCell id="shape-1" value="Local" vertex="1" parent="1"><mxGeometry x="10" y="20" width="120" height="60" as="geometry"/></mxCell>'
      )
    );
    const incoming = baseDocument(
      wrapGraphModel(
        '<mxCell id="shape-1" value="Incoming" vertex="1" parent="1"><mxGeometry x="30" y="20" width="120" height="60" as="geometry"/></mxCell>'
      )
    );

    const incomingPreferred = mergeDrawioDocuments(local, incoming, "incoming");
    const localPreferred = mergeDrawioDocuments(local, incoming, "local");

    expect(incomingPreferred.pages[0]?.xml).toContain('value="Incoming"');
    expect(localPreferred.pages[0]?.xml).toContain('value="Local"');
  });
});
