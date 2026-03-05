import { describe, expect, it } from "vitest";

import { DIAGRAM_PALETTE_CATALOG } from "@/lib/diagram/diagram-palette-catalog";

describe("diagram palette catalog", () => {
  it("includes required minimal node and edge templates for each diagram kind", () => {
    expect(DIAGRAM_PALETTE_CATALOG.FLUJO.nodeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining([
        "START_END",
        "PROCESS",
        "DECISION",
        "INPUT_OUTPUT",
        "CONNECTOR"
      ])
    );
    expect(DIAGRAM_PALETTE_CATALOG.FLUJO.edgeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining(["FLOW_ARROW"])
    );

    expect(DIAGRAM_PALETTE_CATALOG.SECUENCIA.nodeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining([
        "ACTOR",
        "PARTICIPANT",
        "LIFELINE",
        "ACTIVATION_BAR",
        "COMBINED_FRAGMENT"
      ])
    );
    expect(DIAGRAM_PALETTE_CATALOG.SECUENCIA.edgeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining(["MESSAGE"])
    );

    expect(DIAGRAM_PALETTE_CATALOG.UML_CLASES.nodeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining(["CLASS"])
    );
    expect(DIAGRAM_PALETTE_CATALOG.UML_CLASES.edgeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining(["ASSOCIATION", "INHERITANCE", "AGGREGATION", "COMPOSITION"])
    );

    expect(
      DIAGRAM_PALETTE_CATALOG.ENTIDAD_RELACION.nodeTemplates.map((template) => template.id)
    ).toEqual(expect.arrayContaining(["ENTITY", "ATTRIBUTE", "PRIMARY_KEY", "RELATIONSHIP"]));
    expect(
      DIAGRAM_PALETTE_CATALOG.ENTIDAD_RELACION.edgeTemplates.map((template) => template.id)
    ).toEqual(expect.arrayContaining(["ER_LINK"]));

    expect(DIAGRAM_PALETTE_CATALOG.ESTADO.nodeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining(["INITIAL_STATE", "STATE", "FINAL_STATE"])
    );
    expect(DIAGRAM_PALETTE_CATALOG.ESTADO.edgeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining(["TRANSITION"])
    );

    expect(
      DIAGRAM_PALETTE_CATALOG.ARQUITECTURA.nodeTemplates.map((template) => template.id)
    ).toEqual(
      expect.arrayContaining([
        "COMPONENT_SERVICE",
        "INTERFACE_API",
        "DATABASE_STORAGE",
        "INFRA_SERVER",
        "INFRA_CLOUD",
        "INFRA_CONTAINER"
      ])
    );
    expect(
      DIAGRAM_PALETTE_CATALOG.ARQUITECTURA.edgeTemplates.map((template) => template.id)
    ).toEqual(expect.arrayContaining(["CONNECTION"]));

    expect(DIAGRAM_PALETTE_CATALOG.BPMN.nodeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining([
        "START_EVENT",
        "ACTIVITY_TASK",
        "GATEWAY",
        "END_EVENT",
        "POOL",
        "LANE"
      ])
    );
    expect(DIAGRAM_PALETTE_CATALOG.BPMN.edgeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining(["SEQUENCE_FLOW"])
    );
  });
});
