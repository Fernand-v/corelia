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
  { code: "PRESUPUESTO", displayName: "Presupuesto", description: null, sortOrder: 13 }
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
  { code: "TIEMPO", displayName: "Tiempo", description: null, sortOrder: 22 }
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
    "PRESUPUESTO_GESTIONAR"
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
    "PRESUPUESTO_GESTIONAR"
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
    "PRESUPUESTO_LEER"
  ],
  OBSERVADOR: [
    "USUARIO_LEER",
    "PROYECTO_LEER",
    "TAREA_LEER",
    "CALENDARIO_LEER",
    "REUNION_LEER",
    "NOTIFICACION_LEER",
    "PRESUPUESTO_LEER"
  ],
  INVITADO_EXTERNO: ["PROYECTO_LEER", "TAREA_LEER", "REUNION_LEER"]
};
