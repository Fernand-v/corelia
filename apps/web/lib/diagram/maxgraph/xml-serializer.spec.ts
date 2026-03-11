import { describe, expect, it } from "vitest";

import {
  createEmptyGraphModelXml,
  detectDiagramInputKind,
  normalizeMaxGraphAttributes,
  parseMxfile,
  serializeMxfile
} from "@/lib/diagram/maxgraph/xml-format";
import { parseDiagramSource } from "@/lib/diagram/maxgraph/xml-serializer";

describe("maxgraph xml serializer", () => {
  it("creates a default mxfile when payload is empty", () => {
    const parsed = parseDiagramSource("", "FLUJO");

    expect(parsed.migratedFromLegacy).toBe(false);
    expect(parsed.document.pages.length).toBeGreaterThanOrEqual(1);
    expect(parsed.document.activePageId).toBeTruthy();
  });

  it("wraps a raw mxGraphModel into mxfile document", () => {
    const graphModel =
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="n1" value="Nodo" vertex="1" parent="1"><mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>';

    const parsed = parseDiagramSource(graphModel, "FLUJO");
    const page = parsed.document.pages[0];

    expect(parsed.migratedFromLegacy).toBe(false);
    expect(page?.xml).toContain("<mxGraphModel");
    expect(page?.xml).toContain("value=\"Nodo\"");
  });

  it("parses mxfile multi-page and preserves pages on serialize roundtrip", () => {
    const source =
      '<?xml version="1.0" encoding="UTF-8"?><mxfile host="corelia"><diagram id="p1" name="Page 1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram><diagram id="p2" name="Page 2"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="n2" value="B" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>';

    const parsed = parseDiagramSource(source, "FLUJO");
    const serialized = serializeMxfile(parsed.document);
    const reparsed = parseMxfile(serialized);

    expect(parsed.document.pages).toHaveLength(2);
    expect(reparsed.pages).toHaveLength(2);
    expect(reparsed.pages[1]?.name).toBe("Page 2");
    expect(reparsed.pages[1]?.xml).toContain("value=\"B\"");
  });

  it("normalizes GraphDataModel (maxGraph v0.10+) to mxGraphModel tags", () => {
    const maxGraphXml =
      '<GraphDataModel><root><Cell id="0"/><Cell id="1" parent="0"/><Cell id="shape-1" value="Test" vertex="1" parent="1"><Geometry x="40" y="20" width="120" height="60" as="geometry"/></Cell></root></GraphDataModel>';

    const parsed = parseDiagramSource(maxGraphXml, "FLUJO");
    const page = parsed.document.pages[0];

    expect(parsed.migratedFromLegacy).toBe(false);
    expect(page?.xml).toContain("<mxGraphModel");
    expect(page?.xml).toContain("<mxCell");
    expect(page?.xml).toContain("<mxGeometry");
    expect(page?.xml).not.toContain("<GraphDataModel");
    expect(page?.xml).not.toContain("<Cell ");
    expect(page?.xml).not.toContain("<Geometry ");
    expect(page?.xml).toContain('value="Test"');
  });

  it("detectDiagramInputKind recognizes GraphDataModel as mxgraphmodel", () => {
    const maxGraphXml = '<GraphDataModel><root><Cell id="0"/></root></GraphDataModel>';
    expect(detectDiagramInputKind(maxGraphXml)).toBe("mxgraphmodel");
  });

  it("detectDiagramInputKind recognizes GraphDataModel with xml header", () => {
    const withHeader = '<?xml version="1.0" encoding="UTF-8"?><GraphDataModel><root></root></GraphDataModel>';
    expect(detectDiagramInputKind(withHeader)).toBe("mxgraphmodel");
  });

  it("normalizeGraphModelXml returns mxGraphModel for unknown input", () => {
    const parsed = parseDiagramSource("not xml at all", "FLUJO");
    const page = parsed.document.pages[0];
    expect(page?.xml).toContain("<mxGraphModel");
    expect(page?.xml).toContain('<mxCell id="0"');
  });

  it("round-trips GraphDataModel through serialize/parse without losing cells", () => {
    const maxGraphXml =
      '<GraphDataModel><root><Cell id="0"/><Cell id="1" parent="0"/><Cell id="node-a" value="Alpha" vertex="1" parent="1"><Geometry x="100" y="50" width="160" height="80" as="geometry"/></Cell></root></GraphDataModel>';

    const parsed = parseDiagramSource(maxGraphXml, "FLUJO");
    const serialized = serializeMxfile(parsed.document);
    const reparsed = parseMxfile(serialized);

    expect(reparsed.pages).toHaveLength(1);
    expect(reparsed.pages[0]?.xml).toContain('id="node-a"');
    expect(reparsed.pages[0]?.xml).toContain('value="Alpha"');
    expect(reparsed.pages[0]?.xml).not.toContain("<GraphDataModel");
    expect(reparsed.pages[0]?.xml).not.toContain("<Cell ");
  });

  it("empty diagram (only root cells 0 and 1) is detected as empty by DIAGRAM_USER_CELL_REGEX", () => {
    const DIAGRAM_USER_CELL_REGEX = /<mxCell\b[^>]*\bid=(['"])(?!0\1|1\1)[^'"]+\1/i;
    const emptyXml = createEmptyGraphModelXml();
    expect(DIAGRAM_USER_CELL_REGEX.test(emptyXml)).toBe(false);
  });

  it("diagram with user cells is detected as non-empty by DIAGRAM_USER_CELL_REGEX", () => {
    const DIAGRAM_USER_CELL_REGEX = /<mxCell\b[^>]*\bid=(['"])(?!0\1|1\1)[^'"]+\1/i;
    const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="shape-1" value="X" vertex="1" parent="1"/></root></mxGraphModel>';
    expect(DIAGRAM_USER_CELL_REGEX.test(xml)).toBe(true);
  });

  it("GraphDataModel-only cells (not normalized) are NOT detected by DIAGRAM_USER_CELL_REGEX", () => {
    const DIAGRAM_USER_CELL_REGEX = /<mxCell\b[^>]*\bid=(['"])(?!0\1|1\1)[^'"]+\1/i;
    const maxGraphXml = '<GraphDataModel><root><Cell id="0"/><Cell id="1" parent="0"/><Cell id="shape-1" value="X" vertex="1" parent="1"/></root></GraphDataModel>';
    // Without normalization, the regex can't detect user cells — this proves normalization is essential
    expect(DIAGRAM_USER_CELL_REGEX.test(maxGraphXml)).toBe(false);
  });

  it("converts _x/_y/_width/_height to x/y/width/height on geometry tags", () => {
    const maxGraphOutput = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="s1" value="Box" vertex="1" parent="1"><mxGeometry _x="80" _y="208" _width="180" _height="80" as="geometry"/></mxCell></root></mxGraphModel>';

    const normalized = normalizeMaxGraphAttributes(maxGraphOutput);

    expect(normalized).toContain('x="80"');
    expect(normalized).toContain('y="208"');
    expect(normalized).toContain('width="180"');
    expect(normalized).toContain('height="80"');
    expect(normalized).not.toContain('_x="');
    expect(normalized).not.toContain('_y="');
    expect(normalized).not.toContain('_width="');
    expect(normalized).not.toContain('_height="');
  });

  it("converts <Object as='style' .../> to inline style attribute", () => {
    const maxGraphOutput =
      '<mxGraphModel><root><mxCell id="0"><Object as="style" /></mxCell><mxCell id="1" parent="0"><Object as="style" /></mxCell><mxCell id="s1" value="Box" vertex="1" parent="1"><mxGeometry x="80" y="40" width="120" height="60" as="geometry"/><Object rounded="1" arcSize="16" fillColor="#ffffff" strokeColor="#64748b" whiteSpace="wrap" as="style" /></mxCell></root></mxGraphModel>';

    const normalized = normalizeMaxGraphAttributes(maxGraphOutput);

    // User cell should have inline style with all properties
    expect(normalized).toContain('style="rounded=1;arcSize=16;fillColor=#ffffff;strokeColor=#64748b;whiteSpace=wrap"');
    // No <Object as="style"> elements should remain
    expect(normalized).not.toContain("<Object");
  });

  it("handles combined maxGraph issues: tag names + underscored geometry + Object style", () => {
    const fullMaxGraphXml =
      '<mxGraphModel><root><mxCell id="0"><Object as="style" /></mxCell><mxCell id="1" parent="0"><Object as="style" /></mxCell><mxCell id="c1" value="Rect" vertex="1" parent="1"><mxGeometry _x="80" _y="208" _width="180" _height="80" as="geometry" /><Object rounded="1" fillColor="#ffffff" as="style" /></mxCell></root></mxGraphModel>';

    const parsed = parseDiagramSource(fullMaxGraphXml, "FLUJO");
    const page = parsed.document.pages[0];

    // Geometry attributes normalized
    expect(page?.xml).toContain('x="80"');
    expect(page?.xml).toContain('y="208"');
    expect(page?.xml).not.toContain('_x="');
    // Style inlined
    expect(page?.xml).toContain('style="rounded=1;fillColor=#ffffff"');
    expect(page?.xml).not.toContain("<Object");
    // User cell preserved
    expect(page?.xml).toContain('value="Rect"');
  });

  it("preserves geometry through V3 round-trip when _x/_y are present", () => {
    const xmlWithUnderscores =
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="s1" value="A" vertex="1" parent="1"><mxGeometry _x="100" _y="200" _width="150" _height="70" as="geometry"/></mxCell></root></mxGraphModel>';

    const parsed = parseDiagramSource(xmlWithUnderscores, "FLUJO");
    const serialized = serializeMxfile(parsed.document);
    const reparsed = parseMxfile(serialized);

    expect(reparsed.pages[0]?.xml).toContain('x="100"');
    expect(reparsed.pages[0]?.xml).toContain('y="200"');
    expect(reparsed.pages[0]?.xml).toContain('width="150"');
    expect(reparsed.pages[0]?.xml).toContain('height="70"');
    expect(reparsed.pages[0]?.xml).not.toContain("_x=");
  });

  it("migrates legacy react-flow payloads to mxfile", () => {
    const legacyPayload = JSON.stringify({
      diagramKind: "UML_CLASES",
      nodes: [
        {
          id: "node-1",
          data: { label: "User", elementType: "CLASS" },
          position: { x: 120, y: 80 },
          width: 200,
          height: 120
        },
        {
          id: "node-2",
          data: { label: "Role", elementType: "CLASS" },
          position: { x: 420, y: 80 },
          width: 200,
          height: 120
        }
      ],
      edges: [{ id: "edge-1", source: "node-1", target: "node-2", data: { relationType: "ASSOCIATION" } }]
    });

    const parsed = parseDiagramSource(legacyPayload, "FLUJO");
    const page = parsed.document.pages[0];

    expect(parsed.migratedFromLegacy).toBe(true);
    expect(page?.xml).toContain("<mxGraphModel");
    expect(page?.xml).toContain("User");
    expect(page?.xml).toContain("Role");
    expect(page?.xml).toContain("edge=\"1\"");
  });
});
