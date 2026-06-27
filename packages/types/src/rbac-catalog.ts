export const RBAC_PERMISSION_CATEGORIES = [
  { code: "USUARIO", displayName: "Usuarios", description: null, sortOrder: 0 },
  { code: "PROYECTO", displayName: "Proyectos", description: null, sortOrder: 1 },
  { code: "TAREA", displayName: "Tareas", description: null, sortOrder: 2 },
  { code: "CALENDARIO", displayName: "Calendario", description: null, sortOrder: 3 },
  { code: "REUNION", displayName: "Reuniones", description: null, sortOrder: 4 },
  { code: "MENSAJE", displayName: "Mensajeria", description: null, sortOrder: 5 },
  { code: "NOTIFICACION", displayName: "Notificaciones", description: null, sortOrder: 6 },
  { code: "ARCHIVO", displayName: "Archivos", description: null, sortOrder: 7 },
  { code: "ANUNCIO", displayName: "Anuncios", description: null, sortOrder: 8 },
  { code: "SOLICITUD", displayName: "Solicitudes", description: null, sortOrder: 9 },
  { code: "OBJETIVO", displayName: "Objetivos", description: null, sortOrder: 10 },
  { code: "AUTOMATIZACION", displayName: "Automatizaciones", description: null, sortOrder: 11 },
  { code: "AUDITORIA", displayName: "Auditoria", description: null, sortOrder: 12 },
  { code: "PRESUPUESTO", displayName: "Presupuesto", description: null, sortOrder: 13 },
  { code: "TICKET", displayName: "Tickets", description: null, sortOrder: 14 },
  { code: "PERSONA", displayName: "Personas y catalogos", description: null, sortOrder: 15 },
  { code: "LLAMADA", displayName: "Llamadas", description: null, sortOrder: 16 }
] as const;

export const RBAC_PROGRAMS = [
  { code: "ADMINISTRACION", displayName: "Administracion", description: null, sortOrder: 0 },
  { code: "IDENTIDAD", displayName: "Identidad", description: null, sortOrder: 1 },
  { code: "PROYECTOS", displayName: "Proyectos", description: null, sortOrder: 2 },
  { code: "TAREAS", displayName: "Tareas", description: null, sortOrder: 3 },
  { code: "CALENDARIO", displayName: "Calendario", description: null, sortOrder: 4 },
  { code: "REUNIONES", displayName: "Reuniones", description: null, sortOrder: 5 },
  { code: "MENSAJERIA", displayName: "Mensajeria", description: null, sortOrder: 6 },
  { code: "NOTIFICACIONES", displayName: "Notificaciones", description: null, sortOrder: 7 },
  { code: "ARCHIVOS", displayName: "Archivos", description: null, sortOrder: 8 },
  { code: "ANUNCIOS", displayName: "Anuncios", description: null, sortOrder: 9 },
  { code: "FORMULARIOS", displayName: "Formularios", description: null, sortOrder: 10 },
  { code: "OBJETIVOS", displayName: "Objetivos", description: null, sortOrder: 11 },
  { code: "AUTOMATIZACIONES", displayName: "Automatizaciones", description: null, sortOrder: 12 },
  { code: "AUDITORIA", displayName: "Auditoria", description: null, sortOrder: 13 },
  { code: "PRESUPUESTO", displayName: "Presupuesto", description: null, sortOrder: 14 },
  { code: "DOCUMENTOS", displayName: "Documentos", description: null, sortOrder: 15 },
  { code: "REPORTES", displayName: "Reportes", description: null, sortOrder: 16 },
  { code: "BUSQUEDA", displayName: "Busqueda", description: null, sortOrder: 17 },
  { code: "DECISIONES", displayName: "Decisiones", description: null, sortOrder: 18 },
  { code: "INTEGRACIONES", displayName: "Integraciones", description: null, sortOrder: 19 },
  { code: "IMPORTACIONES", displayName: "Importaciones", description: null, sortOrder: 20 },
  { code: "DISPONIBILIDAD", displayName: "Disponibilidad", description: null, sortOrder: 21 },
  { code: "TIEMPO", displayName: "Tiempo", description: null, sortOrder: 22 },
  { code: "TICKETS", displayName: "Tickets IT", description: null, sortOrder: 23 },
  { code: "PERSONAS", displayName: "Personas", description: null, sortOrder: 24 },
  { code: "LLAMADAS", displayName: "Llamadas", description: null, sortOrder: 25 }
] as const;

export const RBAC_PERMISSIONS = [
  {
    code: "USUARIO_LEER",
    displayName: "Leer usuarios",
    description: null,
    categoryCode: "USUARIO",
    programCode: "IDENTIDAD"
  },
  {
    code: "USUARIO_GESTIONAR",
    displayName: "Gestionar usuarios",
    description: null,
    categoryCode: "USUARIO",
    programCode: "IDENTIDAD"
  },
  {
    code: "PROYECTO_LEER",
    displayName: "Leer proyectos",
    description: null,
    categoryCode: "PROYECTO",
    programCode: "PROYECTOS"
  },
  {
    code: "PROYECTO_GESTIONAR",
    displayName: "Gestionar proyectos",
    description: null,
    categoryCode: "PROYECTO",
    programCode: "PROYECTOS"
  },
  {
    code: "TAREA_LEER",
    displayName: "Leer tareas",
    description: null,
    categoryCode: "TAREA",
    programCode: "TAREAS"
  },
  {
    code: "TAREA_GESTIONAR",
    displayName: "Gestionar tareas",
    description: null,
    categoryCode: "TAREA",
    programCode: "TAREAS"
  },
  {
    code: "TAREA_REASIGNAR",
    displayName: "Reasignar tareas",
    description: null,
    categoryCode: "TAREA",
    programCode: "TAREAS"
  },
  {
    code: "TAREA_CAMBIAR_ESTADO",
    displayName: "Cambiar estado de tarea",
    description: null,
    categoryCode: "TAREA",
    programCode: "TAREAS"
  },
  {
    code: "CALENDARIO_LEER",
    displayName: "Leer calendario",
    description: null,
    categoryCode: "CALENDARIO",
    programCode: "CALENDARIO"
  },
  {
    code: "CALENDARIO_GESTIONAR",
    displayName: "Gestionar calendario",
    description: null,
    categoryCode: "CALENDARIO",
    programCode: "CALENDARIO"
  },
  {
    code: "REUNION_LEER",
    displayName: "Leer reuniones",
    description: null,
    categoryCode: "REUNION",
    programCode: "REUNIONES"
  },
  {
    code: "REUNION_GESTIONAR",
    displayName: "Gestionar reuniones",
    description: null,
    categoryCode: "REUNION",
    programCode: "REUNIONES"
  },
  {
    code: "MENSAJE_ESCRIBIR",
    displayName: "Escribir mensajes",
    description: null,
    categoryCode: "MENSAJE",
    programCode: "MENSAJERIA"
  },
  {
    code: "NOTIFICACION_LEER",
    displayName: "Leer notificaciones",
    description: null,
    categoryCode: "NOTIFICACION",
    programCode: "NOTIFICACIONES"
  },
  {
    code: "ARCHIVO_SUBIR",
    displayName: "Subir archivos",
    description: null,
    categoryCode: "ARCHIVO",
    programCode: "ARCHIVOS"
  },
  {
    code: "ANUNCIO_PUBLICAR",
    displayName: "Publicar anuncios",
    description: null,
    categoryCode: "ANUNCIO",
    programCode: "ANUNCIOS"
  },
  {
    code: "SOLICITUD_APROBAR",
    displayName: "Aprobar solicitudes",
    description: null,
    categoryCode: "SOLICITUD",
    programCode: "FORMULARIOS"
  },
  {
    code: "OBJETIVO_GESTIONAR",
    displayName: "Gestionar objetivos",
    description: null,
    categoryCode: "OBJETIVO",
    programCode: "OBJETIVOS"
  },
  {
    code: "AUTOMATIZACION_GESTIONAR",
    displayName: "Gestionar automatizaciones",
    description: null,
    categoryCode: "AUTOMATIZACION",
    programCode: "AUTOMATIZACIONES"
  },
  {
    code: "AUDITORIA_LEER",
    displayName: "Leer auditoria",
    description: null,
    categoryCode: "AUDITORIA",
    programCode: "AUDITORIA"
  },
  {
    code: "PRESUPUESTO_LEER",
    displayName: "Leer presupuesto",
    description: null,
    categoryCode: "PRESUPUESTO",
    programCode: "PRESUPUESTO"
  },
  {
    code: "PRESUPUESTO_GESTIONAR",
    displayName: "Gestionar presupuesto",
    description: null,
    categoryCode: "PRESUPUESTO",
    programCode: "PRESUPUESTO"
  },
  {
    code: "TICKET_CREAR",
    displayName: "Crear tickets",
    description: null,
    categoryCode: "TICKET",
    programCode: "TICKETS"
  },
  {
    code: "TICKET_LEER",
    displayName: "Leer tickets",
    description: null,
    categoryCode: "TICKET",
    programCode: "TICKETS"
  },
  {
    code: "TICKET_GESTIONAR",
    displayName: "Gestionar tickets",
    description: null,
    categoryCode: "TICKET",
    programCode: "TICKETS"
  },
  {
    code: "TICKET_ASIGNAR",
    displayName: "Asignar tickets",
    description: null,
    categoryCode: "TICKET",
    programCode: "TICKETS"
  },
  {
    code: "TICKET_COMENTAR",
    displayName: "Comentar tickets",
    description: null,
    categoryCode: "TICKET",
    programCode: "TICKETS"
  },
  {
    code: "CATALOGO_LEER",
    displayName: "Leer catalogos (paises, ciudades, sexo, empresas)",
    description: null,
    categoryCode: "PERSONA",
    programCode: "PERSONAS"
  },
  {
    code: "CATALOGO_GESTIONAR",
    displayName: "Gestionar catalogos (paises, ciudades, sexo, empresas)",
    description: null,
    categoryCode: "PERSONA",
    programCode: "PERSONAS"
  },
  {
    code: "PERSONA_LEER",
    displayName: "Leer personas",
    description: null,
    categoryCode: "PERSONA",
    programCode: "PERSONAS"
  },
  {
    code: "PERSONA_GESTIONAR",
    displayName: "Gestionar personas",
    description: null,
    categoryCode: "PERSONA",
    programCode: "PERSONAS"
  },
  {
    code: "LLAMADA_ACCEDER",
    displayName: "Acceder a llamadas",
    description: null,
    categoryCode: "LLAMADA",
    programCode: "LLAMADAS"
  }
] as const;

export const RBAC_SYSTEM_ROLES = [
  {
    code: "INVITADO_EXTERNO",
    displayName: "Invitado Externo",
    description: null,
    scope: "GLOBAL",
    rank: 0,
    isSystem: true
  },
  {
    code: "OBSERVADOR",
    displayName: "Observador",
    description: null,
    scope: "GLOBAL",
    rank: 1,
    isSystem: true
  },
  {
    code: "COLABORADOR",
    displayName: "Colaborador",
    description: null,
    scope: "GLOBAL",
    rank: 2,
    isSystem: true
  },
  {
    code: "COORDINADOR_EQUIPO",
    displayName: "Coordinador de Equipo",
    description: null,
    scope: "GLOBAL",
    rank: 3,
    isSystem: true
  },
  {
    code: "LIDER_PROYECTO",
    displayName: "Lider de Proyecto",
    description: null,
    scope: "GLOBAL",
    rank: 4,
    isSystem: true
  },
  {
    code: "ADMINISTRADOR",
    displayName: "Administrador",
    description: null,
    scope: "GLOBAL",
    rank: 5,
    isSystem: true
  },
  {
    code: "SOPORTE_IT",
    displayName: "Soporte IT",
    description: "Equipo de informatica responsable de gestionar tickets",
    scope: "GLOBAL",
    rank: 3,
    isSystem: true
  }
] as const;

export const RBAC_ROLE_PERMISSION_MATRIX: Record<string, readonly string[]> = {
  ADMINISTRADOR: RBAC_PERMISSIONS.map((permission) => permission.code),
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
    "ANUNCIO_PUBLICAR",
    "SOLICITUD_APROBAR",
    "OBJETIVO_GESTIONAR",
    "AUTOMATIZACION_GESTIONAR",
    "AUDITORIA_LEER",
    "PRESUPUESTO_LEER",
    "PRESUPUESTO_GESTIONAR",
    "TICKET_CREAR",
    "TICKET_LEER",
    "TICKET_COMENTAR"
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
    "ANUNCIO_PUBLICAR",
    "SOLICITUD_APROBAR",
    "AUDITORIA_LEER",
    "PRESUPUESTO_LEER",
    "PRESUPUESTO_GESTIONAR",
    "TICKET_CREAR",
    "TICKET_LEER",
    "TICKET_COMENTAR"
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
    "ARCHIVO_SUBIR",
    "PRESUPUESTO_LEER",
    "TICKET_CREAR",
    "TICKET_LEER",
    "TICKET_COMENTAR",
    "LLAMADA_ACCEDER"
  ],
  OBSERVADOR: [
    "USUARIO_LEER",
    "PROYECTO_LEER",
    "TAREA_LEER",
    "CALENDARIO_LEER",
    "REUNION_LEER",
    "NOTIFICACION_LEER",
    "PRESUPUESTO_LEER",
    "TICKET_CREAR",
    "TICKET_LEER",
    "TICKET_COMENTAR"
  ],
  SOPORTE_IT: [
    "USUARIO_LEER",
    "NOTIFICACION_LEER",
    "ARCHIVO_SUBIR",
    "MENSAJE_ESCRIBIR",
    "TICKET_CREAR",
    "TICKET_LEER",
    "TICKET_GESTIONAR",
    "TICKET_ASIGNAR",
    "TICKET_COMENTAR"
  ],
  INVITADO_EXTERNO: ["PROYECTO_LEER", "TAREA_LEER", "REUNION_LEER"]
};

/**
 * Acciones canónicas del modelo recurso×acción. Cada permiso del catálogo es
 * exactamente `${recurso}_${acción}`, por lo que el guard reconstruye la key
 * sin necesidad de un índice adicional. `kind` agrupa lectura vs escritura
 * para la grilla de administración y para los toggles masivos ("todo lectura").
 */
export const RBAC_ACTIONS = [
  { code: "LEER", displayName: "Leer", kind: "read" },
  { code: "ACCEDER", displayName: "Acceder", kind: "write" },
  { code: "ESCRIBIR", displayName: "Escribir", kind: "write" },
  { code: "CREAR", displayName: "Crear", kind: "write" },
  { code: "GESTIONAR", displayName: "Gestionar", kind: "write" },
  { code: "ASIGNAR", displayName: "Asignar", kind: "write" },
  { code: "COMENTAR", displayName: "Comentar", kind: "write" },
  { code: "CAMBIAR_ESTADO", displayName: "Cambiar estado", kind: "write" },
  { code: "REASIGNAR", displayName: "Reasignar", kind: "write" },
  { code: "SUBIR", displayName: "Subir", kind: "write" },
  { code: "PUBLICAR", displayName: "Publicar", kind: "write" },
  { code: "APROBAR", displayName: "Aprobar", kind: "write" }
] as const;

// Ordenadas de mayor a menor longitud para que un sufijo compuesto
// (p. ej. CAMBIAR_ESTADO) gane frente a uno simple (ESTADO no existe, pero
// la regla protege futuras acciones de varias palabras).
const ACTION_CODES_BY_LENGTH = RBAC_ACTIONS.map((action) => action.code).sort(
  (a, b) => b.length - a.length
);

/** Reconstruye la key canónica de un permiso a partir de recurso + acción. */
export const permissionKey = (resource: string, action: string): string => `${resource}_${action}`;

/** Descompone una key de permiso en su recurso y acción canónicos. */
export const splitPermissionKey = (key: string): { resource: string; action: string } => {
  for (const action of ACTION_CODES_BY_LENGTH) {
    if (key.endsWith(`_${action}`)) {
      return { resource: key.slice(0, key.length - action.length - 1), action };
    }
  }
  throw new Error(`Permiso sin acción reconocida: ${key}`);
};

/** Catálogo de permisos enriquecido con su recurso y acción derivados. */
export const RBAC_PERMISSIONS_ENRICHED = RBAC_PERMISSIONS.map((permission) => ({
  ...permission,
  ...splitPermissionKey(permission.code)
}));

const RESOURCE_DISPLAY_OVERRIDES: Record<string, string> = {
  CATALOGO: "Catálogos"
};

const categoryDisplayByCode = new Map<string, string>(
  RBAC_PERMISSION_CATEGORIES.map((category) => [category.code, category.displayName])
);

/** Recursos distintos derivados del catálogo, con nombre legible para la UI. */
export const RBAC_RESOURCES = [
  ...new Set(RBAC_PERMISSIONS_ENRICHED.map((permission) => permission.resource))
].map((resource) => ({
  code: resource,
  displayName: RESOURCE_DISPLAY_OVERRIDES[resource] ?? categoryDisplayByCode.get(resource) ?? resource
}));

/**
 * Metadata de navegación de los programas que aparecen en el menú lateral de
 * forma dinámica (sin estar hardcodeados en el frontend). El seed marca estos
 * programas con isNavItem=true y su route/icon/orden. Un administrador puede
 * crear nuevos programas de navegación desde el panel sin tocar código.
 */
export const RBAC_PROGRAM_NAV: Record<string, { route: string; icon: string | null; navOrder: number }> = {
  LLAMADAS: { route: "/call", icon: null, navOrder: 100 }
};
