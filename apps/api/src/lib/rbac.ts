import type { Permission, SystemRole } from "@corelia/types";

const roleRank: Record<SystemRole, number> = {
  INVITADO_EXTERNO: 0,
  OBSERVADOR: 1,
  COLABORADOR: 2,
  COORDINADOR_EQUIPO: 3,
  LIDER_PROYECTO: 4,
  ADMINISTRADOR: 5
};

const rolePermissions: Record<SystemRole, Permission[]> = {
  ADMINISTRADOR: [
    "USUARIO_LEER",
    "USUARIO_GESTIONAR",
    "PROYECTO_LEER",
    "PROYECTO_GESTIONAR",
    "TAREA_LEER",
    "TAREA_GESTIONAR",
    "TAREA_REASIGNAR",
    "TAREA_CAMBIAR_ESTADO",
    "CALENDARIO_LEER",
    "CALENDARIO_GESTIONAR",
    "REUNION_LEER",
    "REUNION_GESTIONAR",
    "MENSAJE_ESCRIBIR",
    "NOTIFICACION_LEER",
    "ARCHIVO_SUBIR",
    "ANUNCIO_PUBLICAR",
    "SOLICITUD_APROBAR",
    "OBJETIVO_GESTIONAR",
    "AUTOMATIZACION_GESTIONAR",
    "AUDITORIA_LEER"
  ],
  LIDER_PROYECTO: [
    "USUARIO_LEER",
    "PROYECTO_LEER",
    "PROYECTO_GESTIONAR",
    "TAREA_LEER",
    "TAREA_GESTIONAR",
    "TAREA_REASIGNAR",
    "TAREA_CAMBIAR_ESTADO",
    "CALENDARIO_LEER",
    "CALENDARIO_GESTIONAR",
    "REUNION_LEER",
    "REUNION_GESTIONAR",
    "MENSAJE_ESCRIBIR",
    "NOTIFICACION_LEER",
    "ARCHIVO_SUBIR",
    "SOLICITUD_APROBAR",
    "OBJETIVO_GESTIONAR",
    "AUTOMATIZACION_GESTIONAR",
    "AUDITORIA_LEER"
  ],
  COORDINADOR_EQUIPO: [
    "USUARIO_LEER",
    "PROYECTO_LEER",
    "TAREA_LEER",
    "TAREA_GESTIONAR",
    "TAREA_REASIGNAR",
    "TAREA_CAMBIAR_ESTADO",
    "CALENDARIO_LEER",
    "CALENDARIO_GESTIONAR",
    "REUNION_LEER",
    "REUNION_GESTIONAR",
    "MENSAJE_ESCRIBIR",
    "NOTIFICACION_LEER",
    "ARCHIVO_SUBIR",
    "SOLICITUD_APROBAR",
    "AUDITORIA_LEER"
  ],
  COLABORADOR: [
    "USUARIO_LEER",
    "PROYECTO_LEER",
    "TAREA_LEER",
    "TAREA_CAMBIAR_ESTADO",
    "CALENDARIO_LEER",
    "REUNION_LEER",
    "REUNION_GESTIONAR",
    "MENSAJE_ESCRIBIR",
    "NOTIFICACION_LEER",
    "ARCHIVO_SUBIR"
  ],
  OBSERVADOR: ["USUARIO_LEER", "PROYECTO_LEER", "TAREA_LEER", "CALENDARIO_LEER", "REUNION_LEER", "NOTIFICACION_LEER"],
  INVITADO_EXTERNO: ["PROYECTO_LEER", "TAREA_LEER", "REUNION_LEER"]
};

export const getPermissionsForRole = (role: SystemRole): Permission[] => {
  return rolePermissions[role] ?? [];
};

export const getMostRestrictiveRole = (roles: SystemRole[]): SystemRole => {
  if (roles.length === 0) {
    return "INVITADO_EXTERNO";
  }

  const firstRole = roles[0] ?? "INVITADO_EXTERNO";

  return roles.reduce((acc, current) => {
    return roleRank[current] < roleRank[acc] ? current : acc;
  }, firstRole);
};

export const canReassign = (role: SystemRole): boolean => {
  return ["ADMINISTRADOR", "LIDER_PROYECTO", "COORDINADOR_EQUIPO"].includes(role);
};

export const canReopenCompletedTask = (role: SystemRole): boolean => {
  return ["ADMINISTRADOR", "LIDER_PROYECTO"].includes(role);
};
