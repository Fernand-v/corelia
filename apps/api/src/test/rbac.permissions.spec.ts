import { describe, expect, it } from "vitest";
import {
  canReassign,
  canReopenCompletedTask,
  getMostRestrictiveRole,
  getPermissionsForRole,
  isAdminRole,
  isManagerOrAbove
} from "../lib/rbac.js";

describe("RBAC permission matrix", () => {
  it("resolves most restrictive role outside project context", () => {
    const role = getMostRestrictiveRole(["LIDER_PROYECTO", "COLABORADOR"]);
    expect(role).toBe("COLABORADOR");
  });

  it("falls back to invitado externo when roles list is empty", () => {
    expect(getMostRestrictiveRole([])).toBe("INVITADO_EXTERNO");
  });

  it("does not allow collaborator reassignment", () => {
    expect(canReassign("COLABORADOR")).toBe(false);
  });

  it("does not allow invitado externo editing", () => {
    const permissions = getPermissionsForRole("INVITADO_EXTERNO");
    expect(permissions).not.toContain("TAREA_GESTIONAR");
    expect(permissions).not.toContain("TAREA_REASIGNAR");
  });

  it("allows reopen only for lider/admin", () => {
    expect(canReopenCompletedTask("LIDER_PROYECTO")).toBe(true);
    expect(canReopenCompletedTask("ADMINISTRADOR")).toBe(true);
    expect(canReopenCompletedTask("COORDINADOR_EQUIPO")).toBe(false);
  });

  it("resolves helper checks for admin and manager rank", () => {
    expect(isAdminRole("ADMINISTRADOR")).toBe(true);
    expect(isAdminRole(null)).toBe(false);
    expect(isManagerOrAbove(3)).toBe(true);
    expect(isManagerOrAbove(2)).toBe(false);
  });
});
