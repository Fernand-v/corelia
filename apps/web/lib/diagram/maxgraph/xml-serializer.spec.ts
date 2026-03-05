import { describe, expect, it } from "vitest";

import { parseMxfile, serializeMxfile } from "@/lib/diagram/maxgraph/xml-format";
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
