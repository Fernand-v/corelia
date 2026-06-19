import { describe, expect, it } from "vitest";
import type { ConditionalLogic } from "@corelia/types";
import {
  evaluateCondition,
  mapDynamicForm,
  normalizeAnswerValue,
  normalizeOptions,
  parseConditionalLogic,
  parseOptions,
  shouldShowQuestion
} from "../modules/forms/form-helpers.js";

describe("form-helpers", () => {
  describe("normalizeOptions / parseOptions", () => {
    it("dedupes, trims and drops empty options", () => {
      expect(normalizeOptions([" a ", "a", "", "b"])).toEqual(["a", "b"]);
      expect(normalizeOptions([])).toBeNull();
      expect(normalizeOptions(undefined)).toBeNull();
    });

    it("parses only string arrays", () => {
      expect(parseOptions(["x", 1, "y "] as unknown as string[])).toEqual(["x", "y"]);
      expect(parseOptions(null)).toBeNull();
      expect(parseOptions("nope" as unknown as null)).toBeNull();
    });
  });

  describe("normalizeAnswerValue", () => {
    const base = { type: "short_text", label: "Nombre", required: true, options: null };

    it("trims and validates short_text", () => {
      expect(normalizeAnswerValue(base, "  hola  ")).toBe("hola");
    });

    it("throws when a required field is empty", () => {
      expect(() => normalizeAnswerValue(base, "   ")).toThrow(/obligatoria/);
    });

    it("rejects an out-of-range rating", () => {
      const q = { type: "rating", label: "Nota", required: true, options: null };
      expect(() => normalizeAnswerValue(q, 9)).toThrow(/entre 1 y 5/);
      expect(normalizeAnswerValue(q, "4")).toBe(4);
    });

    it("validates multiple_choice against options", () => {
      const q = { type: "multiple_choice", label: "Color", required: true, options: ["rojo", "azul"] };
      expect(normalizeAnswerValue(q, "azul")).toBe("azul");
      expect(() => normalizeAnswerValue(q, "verde")).toThrow(/no es válida/);
    });

    it("dedupes checkbox values and rejects invalid ones", () => {
      const q = { type: "checkbox", label: "Tags", required: true, options: ["a", "b"] };
      expect(normalizeAnswerValue(q, ["a", "a", "b"])).toEqual(["a", "b"]);
      expect(() => normalizeAnswerValue(q, ["c"])).toThrow(/no es válida/);
    });
  });

  describe("evaluateCondition / shouldShowQuestion", () => {
    const answers = new Map<string, unknown>([["q1", "5"]]);

    it("evaluates comparison operators", () => {
      const eq: ConditionalLogic = { questionId: "q1", operator: "equals", value: "5", action: "show" };
      expect(evaluateCondition(eq, answers)).toBe(true);
      const gt: ConditionalLogic = { questionId: "q1", operator: "greater_than", value: "3", action: "show" };
      expect(evaluateCondition(gt, answers)).toBe(true);
    });

    it("returns false when the referenced answer is missing", () => {
      const cond: ConditionalLogic = { questionId: "qX", operator: "equals", value: "5", action: "show" };
      expect(evaluateCondition(cond, answers)).toBe(false);
    });

    it("shows questions without conditional logic", () => {
      expect(shouldShowQuestion({ conditionalLogic: null }, answers)).toBe(true);
    });

    it("inverts the result for a hide action", () => {
      const logic = { questionId: "q1", operator: "equals", value: "5", action: "hide" };
      expect(shouldShowQuestion({ conditionalLogic: logic }, answers)).toBe(false);
    });
  });

  describe("parseConditionalLogic", () => {
    it("returns null for malformed logic", () => {
      expect(parseConditionalLogic(null)).toBeNull();
      expect(parseConditionalLogic({ foo: "bar" })).toBeNull();
    });

    it("accepts well-formed logic", () => {
      const logic = { questionId: "q1", operator: "equals", value: "x", action: "show" };
      expect(parseConditionalLogic(logic)).toMatchObject({ questionId: "q1" });
    });
  });

  describe("mapDynamicForm", () => {
    it("serializes dates and derives counts", () => {
      const mapped = mapDynamicForm({
        id: "f1",
        title: "Encuesta",
        description: null,
        createdById: "u1",
        projectId: null,
        isActive: true,
        allowMultipleSubmissions: false,
        isAnonymous: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: { id: "u1", firstName: "Ana", lastName: "Paz" },
        _count: { questions: 3, responses: 2 },
        responses: [{ id: "r1" }]
      });

      expect(mapped.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(mapped.questionCount).toBe(3);
      expect(mapped.responseCount).toBe(2);
      expect(mapped.submittedByMe).toBe(true);
      expect(mapped.createdBy).toEqual({ id: "u1", fullName: "Ana Paz" });
    });
  });
});
