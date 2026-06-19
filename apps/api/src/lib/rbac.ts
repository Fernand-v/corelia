export const isAdminRole = (roleCode: string | null | undefined): boolean => {
  return roleCode === "ADMINISTRADOR";
};

export const isManagerOrAbove = (rank: number): boolean => {
  return rank >= 3;
};

export const canReassign = (rank: number): boolean => {
  return rank >= 3;
};

export const canReopenCompletedTask = (rank: number): boolean => {
  return rank >= 4;
};

/**
 * Extrae la clave de rol de un objeto que puede tener `key` o `code`.
 * Centralizado aquí para evitar duplicación entre módulos.
 */
export const resolveRoleKey = (
  role: { key?: string | null; code?: string | number | null } | null | undefined
): string | undefined => {
  if (!role) return undefined;
  if (typeof role.key === "string") return role.key;
  if (typeof role.code === "string") return role.code;
  return undefined;
};
