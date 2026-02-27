import { describe, expect, it } from "vitest";
import {
  createUserInputSchema,
  externalCalendarConnectInputSchema,
  meetingParticipantStateUpdateSchema,
  systemRoleSchema,
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

  it("enforces blocked status requirements", () => {
    expect(() =>
      taskStatusTransitionInputSchema.parse({
        taskId: crypto.randomUUID(),
        status: "BLOQUEADA",
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
    expect(systemRoleSchema.options).toContain("ADMINISTRADOR");
    expect(systemRoleSchema.options).toContain("INVITADO_EXTERNO");
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
