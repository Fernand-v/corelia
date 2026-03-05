import { describe, expect, it } from "vitest";

import { connectWithEdgeTemplate, insertNodeFromTemplate } from "@/lib/diagram/diagram-insertions";
import { createDefaultStateForKind } from "@/lib/diagram/diagram-model";
import { getPaletteForKind } from "@/lib/diagram/diagram-palette-catalog";

describe("diagram insertions", () => {
  it("inserts node from template preserving element type and default properties", () => {
    const initial = createDefaultStateForKind("UML_CLASES");
    const classTemplate = getPaletteForKind("UML_CLASES").nodeTemplates.find(
      (template) => template.id === "CLASS"
    );

    expect(classTemplate).toBeDefined();
    if (!classTemplate) {
      throw new Error("CLASS template should exist");
    }

    const next = insertNodeFromTemplate(initial, classTemplate, {
      canvasWidth: 1200,
      canvasHeight: 700
    });

    expect(next.nodes.length).toBe(initial.nodes.length + 1);
    const inserted = next.nodes[next.nodes.length - 1];
    expect(inserted?.type).toBe("diagramNode");
    expect(inserted?.data.elementType).toBe("CLASS");
    expect(inserted?.data.properties?.attributes).toBeDefined();
    expect(inserted?.data.properties?.methods).toBeDefined();
  });

  it("connects nodes with selected relation template and metadata", () => {
    const initial = createDefaultStateForKind("ENTIDAD_RELACION");
    const edgeTemplate = getPaletteForKind("ENTIDAD_RELACION").edgeTemplates.find(
      (template) => template.id === "ER_LINK"
    );

    expect(edgeTemplate).toBeDefined();
    if (!edgeTemplate) {
      throw new Error("ER_LINK template should exist");
    }
    const sourceId = initial.nodes[0]?.id;
    const targetId = initial.nodes[1]?.id;
    if (!sourceId || !targetId) {
      throw new Error("default state must include source and target nodes");
    }

    const next = connectWithEdgeTemplate(initial, edgeTemplate, {
      source: sourceId,
      target: targetId,
      sourceHandle: null,
      targetHandle: null
    });

    expect(next.edges.length).toBe(initial.edges.length + 1);
    const inserted = next.edges[next.edges.length - 1];

    expect(inserted?.type).toBe("diagramRelation");
    expect(inserted?.data?.relationType).toBe("ER_LINK");
    expect(inserted?.data?.properties?.sourceCardinality).toBe("1");
    expect(inserted?.data?.properties?.targetCardinality).toBe("N");
  });
});
