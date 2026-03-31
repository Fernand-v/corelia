import { describe, expect, it } from "vitest";
import {
  canReassign,
  canReopenCompletedTask,
  isAdminRole,
  isManagerOrAbove
} from "../lib/rbac.js";

describe("RBAC permission helpers", () => {
  it("does not allow reassignment for rank < 3", () => {
    expect(canReassign(0)).toBe(false);
    expect(canReassign(1)).toBe(false);
    expect(canReassign(2)).toBe(false);
  });

  it("allows reassignment for rank >= 3", () => {
    expect(canReassign(3)).toBe(true);
    expect(canReassign(4)).toBe(true);
    expect(canReassign(5)).toBe(true);
  });

  it("allows reopen only for rank >= 4 (lider/admin)", () => {
    expect(canReopenCompletedTask(4)).toBe(true);
    expect(canReopenCompletedTask(5)).toBe(true);
    expect(canReopenCompletedTask(3)).toBe(false);
    expect(canReopenCompletedTask(2)).toBe(false);
  });

  it("resolves helper checks for admin and manager rank", () => {
    expect(isAdminRole("ADMINISTRADOR")).toBe(true);
    expect(isAdminRole(null)).toBe(false);
    expect(isManagerOrAbove(3)).toBe(true);
    expect(isManagerOrAbove(2)).toBe(false);
  });
});
