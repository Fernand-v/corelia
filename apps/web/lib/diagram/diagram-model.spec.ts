import { describe, expect, it } from "vitest";

import {
  createEdgePropertyPatch,
  createNodePropertyPatch,
  normalizeDiagramState
} from "@/lib/diagram/diagram-model";

describe("diagram model", () => {
  it("normalizes empty payload into default state using fallback kind", () => {
    const state = normalizeDiagramState("", "BPMN");

    expect(state.modelVersion).toBe(2);
    expect(state.engine).toBe("REACT_FLOW");
    expect(state.diagramKind).toBe("BPMN");
    expect(state.nodes.length).toBeGreaterThan(0);
    expect(state.edges.length).toBeGreaterThan(0);
  });

  it("normalizes legacy payload without typed element/relation metadata", () => {
    const legacyPayload = JSON.stringify({
      engine: "REACT_FLOW",
      nodes: [{ id: "n-1", position: { x: 40, y: 50 }, data: { label: "Legacy" } }],
      edges: [{ id: "e-1", source: "n-1", target: "n-1" }],
      viewport: { x: 1, y: 2, zoom: 0.9 }
    });

    const state = normalizeDiagramState(legacyPayload, "FLUJO");

    expect(state.modelVersion).toBe(2);
    expect(state.diagramKind).toBe("FLUJO");
    expect(state.nodes[0]?.type).toBe("diagramNode");
    expect(state.nodes[0]?.data.elementType).toBe("GENERIC");
    expect(state.edges[0]?.type).toBe("diagramRelation");
    expect(state.edges[0]?.data?.relationType).toBe("FLOW_ARROW");
  });

  it("creates and clears node/edge property patches safely", () => {
    const nodePatch = createNodePropertyPatch({ attributes: "id" }, "methods", "save()");
    expect(nodePatch).toEqual({ attributes: "id", methods: "save()" });

    const nodePatchCleared = createNodePropertyPatch({ methods: "save()" }, "methods", "   ");
    expect(nodePatchCleared).toBeUndefined();

    const edgePatch = createEdgePropertyPatch({ sourceMultiplicity: "1" }, "targetMultiplicity", "*");
    expect(edgePatch).toEqual({ sourceMultiplicity: "1", targetMultiplicity: "*" });

    const edgePatchCleared = createEdgePropertyPatch({ trigger: "start" }, "trigger", "");
    expect(edgePatchCleared).toBeUndefined();
  });
});
