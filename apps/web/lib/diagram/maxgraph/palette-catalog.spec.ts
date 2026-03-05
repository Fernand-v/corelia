import { describe, expect, it } from "vitest";

import type { DiagramKind } from "@corelia/types";
import { getPaletteForKind } from "@/lib/diagram/maxgraph/palette-catalog";

const requiredTemplatesByKind: Record<
  DiagramKind,
  { shapes: string[]; edges: string[]; libraryIds: string[] }
> = {
  FLUJO: {
    shapes: ["flow-start", "flow-end", "flow-process", "flow-decision"],
    edges: ["flow-yes", "flow-no"],
    libraryIds: ["general", "flow-core"]
  },
  SECUENCIA: {
    shapes: ["seq-actor", "seq-system", "seq-lifeline", "seq-fragment-loop"],
    edges: ["seq-sync", "seq-async", "seq-response"],
    libraryIds: ["general", "uml-sequence"]
  },
  UML_CLASES: {
    shapes: ["class", "interface", "enum"],
    edges: ["uml-inherit", "uml-impl", "uml-assoc"],
    libraryIds: ["general", "uml-classes"]
  },
  ENTIDAD_RELACION: {
    shapes: ["er-entity", "er-weak-entity", "er-attribute", "er-relation"],
    edges: ["er-11", "er-1n", "er-nm"],
    libraryIds: ["general", "er"]
  },
  ESTADO: {
    shapes: ["state-initial", "state-simple", "state-final", "state-fork"],
    edges: ["state-transition"],
    libraryIds: ["general", "state"]
  },
  ARQUITECTURA: {
    shapes: ["c4-person", "c4-system", "c4-container", "c4-database"],
    edges: ["c4-sync", "c4-async"],
    libraryIds: ["general", "c4"]
  },
  BPMN: {
    shapes: ["bpmn-start", "bpmn-task", "bpmn-gateway", "bpmn-end"],
    edges: ["bpmn-sequence"],
    libraryIds: ["general", "bpmn"]
  }
};

describe("maxgraph palette catalog", () => {
  it("provides required libraries and templates for each diagram kind", () => {
    const kinds = Object.keys(requiredTemplatesByKind) as DiagramKind[];

    for (const kind of kinds) {
      const palette = getPaletteForKind(kind);
      const libraryIds = palette.map((library) => library.id);
      const shapeIds = palette.flatMap((library) => library.shapes.map((shape) => shape.id));
      const edgeIds = palette.flatMap((library) => (library.edges ?? []).map((edge) => edge.id));

      expect(libraryIds).toEqual(expect.arrayContaining(requiredTemplatesByKind[kind].libraryIds));
      expect(shapeIds).toEqual(expect.arrayContaining(requiredTemplatesByKind[kind].shapes));
      expect(edgeIds).toEqual(expect.arrayContaining(requiredTemplatesByKind[kind].edges));
    }
  });
});
