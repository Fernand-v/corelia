import { describe, expect, it } from "vitest";
import {
  canManageTaskProject,
  ensureProjectContext,
  forbidden,
  LEGACY_UNMAPPED_CODE,
  normalizeLegacyCode
} from "../modules/tasks/task-helpers.js";

describe("task-helpers", () => {
  describe("normalizeLegacyCode", () => {
    it("prefers a trimmed code", () => {
      expect(normalizeLegacyCode({ code: "  ABC " })).toBe("ABC");
    });

    it("falls back to the legacy marker when only text is present", () => {
      expect(normalizeLegacyCode({ text: "algo" })).toBe(LEGACY_UNMAPPED_CODE);
    });

    it("returns null when nothing is provided", () => {
      expect(normalizeLegacyCode({})).toBeNull();
      expect(normalizeLegacyCode({ code: "   ", text: "  " })).toBeNull();
    });
  });

  describe("forbidden", () => {
    it("creates an error named Forbidden", () => {
      const error = forbidden("nope");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("Forbidden");
      expect(error.message).toBe("nope");
    });
  });

  describe("ensureProjectContext", () => {
    it("allows admins (rank >= 5) regardless of context", () => {
      expect(() =>
        ensureProjectContext({ taskProjectId: "p1", activeRoleRank: 5, projectContextId: null })
      ).not.toThrow();
    });

    it("requires a matching project context for non-admins", () => {
      expect(() =>
        ensureProjectContext({ taskProjectId: "p1", activeRoleRank: 3, projectContextId: "p2" })
      ).toThrow(/contexto del proyecto/);
      expect(() =>
        ensureProjectContext({ taskProjectId: "p1", activeRoleRank: 3, projectContextId: "p1" })
      ).not.toThrow();
    });
  });

  describe("canManageTaskProject", () => {
    it("returns false for ranks below manager", () => {
      expect(canManageTaskProject({ taskProjectId: "p1", activeRoleRank: 2, projectContextId: "p1" })).toBe(
        false
      );
    });

    it("returns true for a manager in the right context", () => {
      expect(canManageTaskProject({ taskProjectId: "p1", activeRoleRank: 3, projectContextId: "p1" })).toBe(
        true
      );
    });

    it("throws for a manager operating outside the task project", () => {
      expect(() =>
        canManageTaskProject({ taskProjectId: "p1", activeRoleRank: 3, projectContextId: "p2" })
      ).toThrow(/contexto del proyecto/);
    });
  });
});
