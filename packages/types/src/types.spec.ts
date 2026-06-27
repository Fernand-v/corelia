import { describe, expect, it } from "vitest";
import {
  RBAC_SYSTEM_ROLES,
  RBAC_PERMISSIONS,
  RBAC_PERMISSIONS_ENRICHED,
  createUserInputSchema,
  externalCalendarConnectInputSchema,
  meetingParticipantStateUpdateSchema,
  permissionKey,
  splitPermissionKey,
  taskReassignmentInputSchema,
  taskStatusTransitionInputSchema
} from "./index.js";

describe("shared schemas", () => {
  it("validates user creation", () => {
    const parsed = createUserInputSchema.parse({
      email: "test@corelia.local",
      firstName: "Ana",
      lastName: "Suarez",
      password: "secretpass123",
      baseRole: "COLABORADOR"
    });

    expect(parsed.baseRole).toBe("COLABORADOR");
  });

  it("rejects legacy task statuses not present in the normalized model", () => {
    expect(() =>
      taskStatusTransitionInputSchema.parse({
        taskId: crypto.randomUUID(),
        status: "EN_PROGRESO",
        reason: "Bloqueada"
      })
    ).toThrowError();
  });

  it("requires reason for reassignment", () => {
    expect(() =>
      taskReassignmentInputSchema.parse({
        taskId: crypto.randomUUID(),
        newAssigneeId: crypto.randomUUID(),
        reason: "x"
      })
    ).toThrowError();
  });

  it("contains required roles", () => {
    const roleCodes = RBAC_SYSTEM_ROLES.map((role) => role.code);
    expect(roleCodes).toContain("ADMINISTRADOR");
    expect(roleCodes).toContain("INVITADO_EXTERNO");
  });

  it("requires participant state fields on realtime updates", () => {
    expect(() =>
      meetingParticipantStateUpdateSchema.parse({
        meetingId: crypto.randomUUID()
      })
    ).toThrowError();
  });

  it("accepts external calendar oauth connection payload", () => {
    const parsed = externalCalendarConnectInputSchema.parse({
      provider: "GOOGLE",
      authorizationCode: "oauth-code-123456"
    });

    expect(parsed.provider).toBe("GOOGLE");
  });

  it("splits every catalog permission into resource + action that round-trips to its key", () => {
    for (const permission of RBAC_PERMISSIONS) {
      const { resource, action } = splitPermissionKey(permission.code);
      expect(resource.length).toBeGreaterThan(0);
      expect(action.length).toBeGreaterThan(0);
      expect(permissionKey(resource, action)).toBe(permission.code);
    }
  });

  it("enriches every permission with resource and action", () => {
    expect(RBAC_PERMISSIONS_ENRICHED).toHaveLength(RBAC_PERMISSIONS.length);
    for (const permission of RBAC_PERMISSIONS_ENRICHED) {
      expect(permission.resource).toBeTruthy();
      expect(permission.action).toBeTruthy();
    }
  });

  it("throws when a permission key has no recognised action suffix", () => {
    expect(() => splitPermissionKey("RECURSO_DESCONOCIDO_XYZ")).toThrowError();
  });
});
