import { describe, expect, it } from "vitest";
import {
  canReassign,
  canReopenCompletedTask,
  getMostRestrictiveRole,
  getPermissionsForRole
} from "../lib/rbac.js";

describe("RBAC permission matrix", () => {
  it("resolves most restrictive role outside project context", () => {
    const role = getMostRestrictiveRole(["LIDER_PROYECTO", "COLABORADOR"]);
    expect(role).toBe("COLABORADOR");
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
});
