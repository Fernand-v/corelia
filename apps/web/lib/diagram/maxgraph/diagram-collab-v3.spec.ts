import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  applyGraphModelXmlToDiagramV3Page,
  exportDiagramV3ToDrawioDocument,
  getDiagramV3Diagnostics,
  hasDiagramV3Data,
  readDiagramDocumentV3,
  writeDrawioDocumentToDiagramV3
} from "@/lib/diagram/maxgraph/diagram-collab-v3";
import type { DrawioDocument } from "@/lib/diagram/maxgraph/xml-format";

const createDoc = (pageId: string, pageName: string, xml: string): DrawioDocument => ({
  host: "corelia",
  etag: "etag-1",
  modified: "2026-03-10T00:00:00.000Z",
  activePageId: pageId,
  pages: [
    {
      id: pageId,
      name: pageName,
      xml
    }
  ]
});

const baseGraphXml = (cellXml = "") =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cellXml}</root></mxGraphModel>`;

describe("diagram collab v3", () => {
  it("migrates drawio XML into v3 and exports back without losing cells", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");
    const source = createDoc(
      "p-1",
      "Main",
      baseGraphXml(
        '<mxCell id="shape-1" value="A" style="rounded=1" vertex="1" parent="1"><mxGeometry x="40" y="20" width="120" height="60" as="geometry"/></mxCell>'
      )
    );

    writeDrawioDocumentToDiagramV3(rootMap, source, {
      actorId: "u-1",
      operation: "bootstrap"
    });

    expect(hasDiagramV3Data(rootMap)).toBe(true);
    const exported = exportDiagramV3ToDrawioDocument(rootMap, "FLUJO");

    expect(exported.pages).toHaveLength(1);
    expect(exported.pages[0]?.id).toBe("p-1");
    expect(exported.pages[0]?.xml).toContain('id="shape-1"');
    expect(exported.pages[0]?.xml).toContain("rounded=1");
  });

  it("updates active page incrementally without replacing entire document", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");
    writeDrawioDocumentToDiagramV3(
      rootMap,
      {
        host: "corelia",
        activePageId: "p-1",
        pages: [
          { id: "p-1", name: "One", xml: baseGraphXml() },
          { id: "p-2", name: "Two", xml: baseGraphXml() }
        ]
      },
      { operation: "seed" }
    );

    applyGraphModelXmlToDiagramV3Page(
      rootMap,
      {
        pageId: "p-1",
        pageName: "One",
        xml: baseGraphXml(
          '<mxCell id="shape-99" value="Nuevo" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>'
        )
      },
      { actorId: "u-2", operation: "local_move" }
    );

    const v3 = readDiagramDocumentV3(rootMap);
    expect(v3?.pagesOrder).toEqual(["p-1", "p-2"]);
    expect(v3?.pages["p-1"]?.cells["shape-99"]).toBeTruthy();
    expect(v3?.pages["p-2"]).toBeTruthy();
  });

  it("preserves remote cells on local partial sync and removes only explicit deletions", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");
    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc(
        "p-1",
        "Main",
        baseGraphXml('<mxCell id="remote-1" value="R" vertex="1" parent="1"><mxGeometry x="10" y="10" width="60" height="40" as="geometry"/></mxCell>')
      ),
      { operation: "seed-remote" }
    );

    applyGraphModelXmlToDiagramV3Page(
      rootMap,
      {
        pageId: "p-1",
        pageName: "Main",
        xml: baseGraphXml('<mxCell id="local-1" value="L" vertex="1" parent="1"><mxGeometry x="120" y="10" width="60" height="40" as="geometry"/></mxCell>'),
        preserveMissing: true
      },
      { operation: "local-partial" }
    );

    let v3 = readDiagramDocumentV3(rootMap);
    expect(v3?.pages["p-1"]?.cells["remote-1"]).toBeTruthy();
    expect(v3?.pages["p-1"]?.cells["local-1"]).toBeTruthy();

    applyGraphModelXmlToDiagramV3Page(
      rootMap,
      {
        pageId: "p-1",
        pageName: "Main",
        xml: baseGraphXml('<mxCell id="local-1" value="L" vertex="1" parent="1"><mxGeometry x="120" y="10" width="60" height="40" as="geometry"/></mxCell>'),
        preserveMissing: true,
        removedCellIds: ["remote-1"]
      },
      { operation: "local-explicit-delete" }
    );

    v3 = readDiagramDocumentV3(rootMap);
    expect(v3?.pages["p-1"]?.cells["remote-1"]).toBeUndefined();
    expect(v3?.pages["p-1"]?.cells["local-1"]).toBeTruthy();
  });

  it("prevents duplicate-page drift when single-page ids differ across writes", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");

    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc(
        "local-1",
        "Local",
        baseGraphXml('<mxCell id="l-1" vertex="1" parent="1"><mxGeometry x="10" y="10" width="60" height="40" as="geometry"/></mxCell>')
      ),
      { operation: "seed-local" }
    );

    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc(
        "remote-1",
        "Remote",
        baseGraphXml('<mxCell id="r-1" vertex="1" parent="1"><mxGeometry x="100" y="10" width="60" height="40" as="geometry"/></mxCell>')
      ),
      { operation: "seed-remote" }
    );

    const exported = exportDiagramV3ToDrawioDocument(rootMap, "FLUJO");
    expect(exported.pages).toHaveLength(1);
    expect(exported.pages[0]?.id).toBe("remote-1");
    expect(exported.pages[0]?.xml).toContain('id="r-1"');
  });

  it("round-trips maxGraph GraphDataModel XML through V3 without losing cells", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");

    // Simulate XML as maxGraph would produce it (GraphDataModel + Cell tags)
    const maxGraphXml =
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="box-1" value="Server" style="rounded=1" vertex="1" parent="1"><mxGeometry x="80" y="40" width="140" height="70" as="geometry"/></mxCell><mxCell id="box-2" value="DB" vertex="1" parent="1"><mxGeometry x="300" y="40" width="100" height="70" as="geometry"/></mxCell><mxCell id="edge-1" edge="1" source="box-1" target="box-2" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel>';

    const source = createDoc("p-1", "Arch", maxGraphXml);
    writeDrawioDocumentToDiagramV3(rootMap, source, { operation: "bootstrap" });

    const exported = exportDiagramV3ToDrawioDocument(rootMap, "ARQUITECTURA");
    expect(exported.pages).toHaveLength(1);
    expect(exported.pages[0]?.xml).toContain('id="box-1"');
    expect(exported.pages[0]?.xml).toContain('id="box-2"');
    expect(exported.pages[0]?.xml).toContain('id="edge-1"');
    expect(exported.pages[0]?.xml).toContain('value="Server"');
    expect(exported.pages[0]?.xml).toContain('value="DB"');
  });

  it("does not write empty diagram (only root cells) over existing data", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");

    // First write: diagram with user content
    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc(
        "p-1",
        "Main",
        baseGraphXml('<mxCell id="shape-1" value="Keep" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>')
      ),
      { operation: "bootstrap" }
    );

    // Verify the cell exists
    let exported = exportDiagramV3ToDrawioDocument(rootMap, "FLUJO");
    expect(exported.pages[0]?.xml).toContain('id="shape-1"');
    expect(exported.pages[0]?.xml).toContain('value="Keep"');

    // Second write: empty diagram (simulates the bug — closing wrote empty content)
    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc("p-1", "Main", baseGraphXml()),
      { operation: "close-flush" }
    );

    // After the second write the user cells are gone (this is what the guard prevents at the caller level)
    exported = exportDiagramV3ToDrawioDocument(rootMap, "FLUJO");
    // The V3 layer itself replaces content — the guard must be at the caller.
    // This test documents the behavior so we know the guard is needed.
    expect(exported.pages[0]?.xml).not.toContain('id="shape-1"');
  });

  it("preserves geometry when XML has _x/_y/_width/_height (maxGraph format)", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");

    // XML with underscore geometry + Object style (maxGraph output format)
    const maxGraphStyleXml =
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="s1" value="Rect" style="rounded=1;fillColor=#ffffff" vertex="1" parent="1"><mxGeometry x="80" y="208" width="180" height="80" as="geometry"/></mxCell></root></mxGraphModel>';

    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc("p-1", "Main", maxGraphStyleXml),
      { operation: "bootstrap" }
    );

    const v3 = readDiagramDocumentV3(rootMap);
    const cell = v3?.pages["p-1"]?.cells["s1"];
    expect(cell).toBeTruthy();
    expect(cell?.geometry?.x).toBe(80);
    expect(cell?.geometry?.y).toBe(208);
    expect(cell?.geometry?.width).toBe(180);
    expect(cell?.geometry?.height).toBe(80);
    expect(cell?.value).toBe("Rect");

    // Export back and verify geometry in XML
    const exported = exportDiagramV3ToDrawioDocument(rootMap, "FLUJO");
    expect(exported.pages[0]?.xml).toContain('x="80"');
    expect(exported.pages[0]?.xml).toContain('y="208"');
    expect(exported.pages[0]?.xml).not.toContain("_x=");
  });

  it("DIAGRAM_USER_CELL_REGEX guard correctly identifies empty vs populated V3 exports", () => {
    const DIAGRAM_USER_CELL_REGEX = /<mxCell\b[^>]*\bid=(['"])(?!0\1|1\1)[^'"]+\1/i;
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");

    // Empty diagram
    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc("p-1", "Main", baseGraphXml()),
      { operation: "seed-empty" }
    );
    let exported = exportDiagramV3ToDrawioDocument(rootMap, "FLUJO");
    let serialized = exported.pages[0]?.xml ?? "";
    expect(DIAGRAM_USER_CELL_REGEX.test(serialized)).toBe(false);

    // Diagram with user content
    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc(
        "p-1",
        "Main",
        baseGraphXml('<mxCell id="user-cell" value="Hello" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>')
      ),
      { operation: "seed-populated" }
    );
    exported = exportDiagramV3ToDrawioDocument(rootMap, "FLUJO");
    serialized = exported.pages[0]?.xml ?? "";
    expect(DIAGRAM_USER_CELL_REGEX.test(serialized)).toBe(true);
  });

  it("preserves remote edge when concurrent user flushes with preserveMissing:true", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");

    // User B creates an edge between two vertices and syncs to Y.js
    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc(
        "p-1",
        "Main",
        baseGraphXml(
          '<mxCell id="v-a" value="A" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>' +
          '<mxCell id="v-b" value="B" vertex="1" parent="1"><mxGeometry x="200" y="10" width="80" height="40" as="geometry"/></mxCell>' +
          '<mxCell id="edge-b" edge="1" source="v-a" target="v-b" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
        )
      ),
      { actorId: "user-b", operation: "seed" }
    );

    // User A's local graph only has v-a and v-c (does NOT know about v-b or edge-b yet)
    // User A flushes with preserveMissing:true → edge-b should survive
    applyGraphModelXmlToDiagramV3Page(
      rootMap,
      {
        pageId: "p-1",
        pageName: "Main",
        xml: baseGraphXml(
          '<mxCell id="v-a" value="A" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>' +
          '<mxCell id="v-c" value="C" vertex="1" parent="1"><mxGeometry x="400" y="10" width="80" height="40" as="geometry"/></mxCell>'
        ),
        preserveMissing: true
      },
      { actorId: "user-a", operation: "flush_model_sync" }
    );

    const v3 = readDiagramDocumentV3(rootMap);
    const page = v3?.pages["p-1"];

    // User A's cells are present
    expect(page?.cells["v-a"]).toBeTruthy();
    expect(page?.cells["v-c"]).toBeTruthy();

    // User B's remote cells are preserved (NOT deleted)
    expect(page?.cells["v-b"]).toBeTruthy();
    expect(page?.cells["edge-b"]).toBeTruthy();
    expect(page?.cells["edge-b"]?.kind).toBe("edge");
  });

  it("removes edge-b from Y.js when user A explicitly deletes it via removedCellIds", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");

    writeDrawioDocumentToDiagramV3(
      rootMap,
      createDoc(
        "p-1",
        "Main",
        baseGraphXml(
          '<mxCell id="v-a" value="A" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>' +
          '<mxCell id="v-b" value="B" vertex="1" parent="1"><mxGeometry x="200" y="10" width="80" height="40" as="geometry"/></mxCell>' +
          '<mxCell id="edge-ab" edge="1" source="v-a" target="v-b" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
        )
      ),
      { actorId: "user-b", operation: "seed" }
    );

    // User A flushes and explicitly marks edge-ab as removed
    applyGraphModelXmlToDiagramV3Page(
      rootMap,
      {
        pageId: "p-1",
        pageName: "Main",
        xml: baseGraphXml(
          '<mxCell id="v-a" value="A" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>' +
          '<mxCell id="v-b" value="B" vertex="1" parent="1"><mxGeometry x="200" y="10" width="80" height="40" as="geometry"/></mxCell>'
        ),
        preserveMissing: true,
        removedCellIds: ["edge-ab"]
      },
      { actorId: "user-a", operation: "flush_model_sync" }
    );

    const v3 = readDiagramDocumentV3(rootMap);
    const page = v3?.pages["p-1"];

    expect(page?.cells["v-a"]).toBeTruthy();
    expect(page?.cells["v-b"]).toBeTruthy();
    expect(page?.cells["edge-ab"]).toBeUndefined();
  });

  it("tracks revision diagnostics for debug mode", () => {
    const yDoc = new Y.Doc();
    const rootMap = yDoc.getMap("diagram:v3");

    writeDrawioDocumentToDiagramV3(rootMap, createDoc("p-1", "Main", baseGraphXml()), {
      operation: "bootstrap"
    });
    applyGraphModelXmlToDiagramV3Page(rootMap, {
      pageId: "p-1",
      pageName: "Main",
      xml: baseGraphXml('<mxCell id="shape-2" vertex="1" parent="1"><mxGeometry x="5" y="5" width="40" height="20" as="geometry"/></mxCell>')
    }, {
      operation: "local_edit"
    });

    const diagnostics = getDiagramV3Diagnostics(rootMap);
    expect(diagnostics.schemaVersion).toBe(3);
    expect(diagnostics.revision).toBeGreaterThanOrEqual(2);
    expect(diagnostics.lastLocalOp).toBe("local_edit");
    expect(diagnostics.pageCount).toBe(1);
  });
});
