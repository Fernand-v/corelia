import { describe, expect, it } from "vitest";
import {
  RBAC_SYSTEM_ROLES,
  createUserInputSchema,
  externalCalendarConnectInputSchema,
  meetingParticipantStateUpdateSchema,
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
});
