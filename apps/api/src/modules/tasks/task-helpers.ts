import { isManagerOrAbove } from "../../lib/rbac.js";

// Helpers puros (sin acceso a base de datos) extraídos de TaskService para
// reducir el tamaño del servicio y poder testearlos de forma aislada.

export const LEGACY_UNMAPPED_CODE = "LEGACY_UNMAPPED";

export const normalizeLegacyCode = (input: {
  code?: string | null | undefined;
  text?: string | null | undefined;
}): string | null => {
  if (input.code?.trim()) {
    return input.code.trim();
  }

  if (input.text?.trim()) {
    return LEGACY_UNMAPPED_CODE;
  }

  return null;
};

export const forbidden = (message: string): Error => {
  const error = new Error(message);
  error.name = "Forbidden";
  return error;
};

export const ensureProjectContext = (input: {
  taskProjectId: string;
  activeRoleRank: number;
  projectContextId?: string | null;
}): void => {
  if (input.activeRoleRank >= 5) {
    return;
  }

  if (!input.projectContextId || input.projectContextId !== input.taskProjectId) {
    throw forbidden("Debes operar en el contexto del proyecto de la tarea");
  }
};

export const canManageTaskProject = (input: {
  taskProjectId: string;
  activeRoleRank: number;
  projectContextId?: string | null;
}): boolean => {
  if (!isManagerOrAbove(input.activeRoleRank)) {
    return false;
  }

  ensureProjectContext(input);
  return true;
};
