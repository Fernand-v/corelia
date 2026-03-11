import {
  RBAC_ROLE_PERMISSION_MATRIX,
  RBAC_SYSTEM_ROLES,
  type Permission,
  type RoleCode
} from "@corelia/types";

const ROLE_RANK_MAP = new Map<string, number>(
  RBAC_SYSTEM_ROLES.map((role) => [role.code, role.rank])
);

export const getPermissionsForRole = (roleCode: string): Permission[] => {
  const permissions = RBAC_ROLE_PERMISSION_MATRIX[roleCode] ?? [];
  return [...permissions] as Permission[];
};

export const getMostRestrictiveRole = (roles: string[]): RoleCode => {
  if (!roles.length) {
    return "INVITADO_EXTERNO";
  }

  return roles.reduce((currentMostRestrictive, currentRole) => {
    const currentRank = ROLE_RANK_MAP.get(currentRole) ?? Number.POSITIVE_INFINITY;
    const selectedRank = ROLE_RANK_MAP.get(currentMostRestrictive) ?? Number.POSITIVE_INFINITY;
    return currentRank < selectedRank ? currentRole : currentMostRestrictive;
  }, roles[0]!) as RoleCode;
};

export const getRoleRank = (roleCode: string): number => {
  return ROLE_RANK_MAP.get(roleCode) ?? -1;
};

export const isAdminRole = (roleCode: string | null | undefined): boolean => {
  return roleCode === "ADMINISTRADOR";
};

export const isManagerOrAbove = (rank: number): boolean => {
  return rank >= 3;
};

export const canReassign = (roleCode: string): boolean => {
  const rank = getRoleRank(roleCode);
  return rank >= 3;
};

export const canReopenCompletedTask = (roleCode: string): boolean => {
  const rank = getRoleRank(roleCode);
  return rank >= 4;
};
