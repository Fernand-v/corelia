import { z } from "zod";

export const systemRoleSchema = z.enum([
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO",
  "COLABORADOR",
  "OBSERVADOR",
  "INVITADO_EXTERNO"
]);

export const taskStatusSchema = z.enum([
  "BACKLOG",
  "PENDIENTE",
  "EN_PROGRESO",
  "EN_REVISION",
  "BLOQUEADA",
  "COMPLETADA",
  "CANCELADA"
]);

export const projectTemplateSchema = z.enum(["SOFTWARE", "CONTENIDO", "OPERACIONES"]);

export const availabilityTypeSchema = z.enum([
  "VACACIONES",
  "PERMISO",
  "AUSENCIA",
  "NO_DISPONIBLE"
]);

export const notificationChannelSchema = z.enum(["EMAIL", "IN_APP"]);

export const notificationFrequencySchema = z.enum(["INMEDIATA", "RESUMEN_DIARIO"]);

export const notificationEventSchema = z.enum([
  "TAREA_ASIGNADA",
  "TAREA_REASIGNADA",
  "TAREA_ESTADO_CAMBIADO",
  "MENSAJE_NUEVO_CANAL",
  "MENCION_MENSAJE",
  "REUNION_PROGRAMADA",
  "ACUERDO_ASIGNADO_TAREA",
  "TAREA_PROXIMA_VENCER",
  "TAREA_BLOQUEADA",
  "SOLICITUD_RESUELTA"
]);

export const requestTypeSchema = z.enum([
  "VACACIONES",
  "PERMISO",
  "ACCESO_RECURSO"
]);

export const requestStatusSchema = z.enum(["PENDIENTE", "APROBADA", "RECHAZADA"]);

export const entityTypeSchema = z.enum([
  "USUARIO",
  "PROYECTO",
  "TAREA",
  "REUNION",
  "ACUERDO_REUNION",
  "MENSAJE",
  "ARCHIVO",
  "SOLICITUD",
  "ANUNCIO",
  "OBJETIVO",
  "DECISION",
  "AUTOMATIZACION"
]);

export const actionTypeSchema = z.enum([
  "LOGIN",
  "LOGOUT",
  "CREAR",
  "ACTUALIZAR",
  "ELIMINAR",
  "PROGRAMAR_REUNION",
  "REGISTRAR_ACUERDO",
  "CAMBIO_ROL",
  "CAMBIO_ESTADO_TAREA",
  "REASIGNAR_TAREA",
  "APROBAR_SOLICITUD",
  "CAMBIO_PERMISO"
]);

export const channelScopeSchema = z.enum(["EQUIPO", "PROYECTO"]);

export const folderScopeSchema = z.enum(["EQUIPO", "PROYECTO"]);

export const searchEntitySchema = z.enum([
  "TAREA",
  "PROYECTO",
  "MENSAJE",
  "PERSONA",
  "ARCHIVO"
]);

export const webhookEventSchema = z.enum([
  "TAREA_COMPLETADA",
  "SOLICITUD_APROBADA",
  "SOLICITUD_RECHAZADA",
  "TAREA_REASIGNADA",
  "TAREA_VENCIDA"
]);

export const meetingStatusSchema = z.enum([
  "PROGRAMADA",
  "EN_CURSO",
  "FINALIZADA",
  "CANCELADA"
]);

export const meetingAgreementStatusSchema = z.enum([
  "PENDIENTE_ACCION",
  "VINCULADO_TAREA",
  "COMPLETADO"
]);

export const calendarScopeSchema = z.enum(["PERSONAL", "EQUIPO", "PROYECTO"]);
export const calendarViewSchema = z.enum(["DIA", "SEMANA", "MES"]);
export const calendarEventTypeSchema = z.enum([
  "TAREA",
  "REUNION",
  "VACACIONES",
  "HITO",
  "EXTERNO"
]);

export const externalCalendarProviderSchema = z.enum(["GOOGLE", "MICROSOFT"]);

export type SystemRole = z.infer<typeof systemRoleSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type ProjectTemplate = z.infer<typeof projectTemplateSchema>;
export type AvailabilityType = z.infer<typeof availabilityTypeSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationFrequency = z.infer<typeof notificationFrequencySchema>;
export type NotificationEvent = z.infer<typeof notificationEventSchema>;
export type RequestType = z.infer<typeof requestTypeSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;
export type ActionType = z.infer<typeof actionTypeSchema>;
export type ChannelScope = z.infer<typeof channelScopeSchema>;
export type FolderScope = z.infer<typeof folderScopeSchema>;
export type SearchEntity = z.infer<typeof searchEntitySchema>;
export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type MeetingStatus = z.infer<typeof meetingStatusSchema>;
export type MeetingAgreementStatus = z.infer<typeof meetingAgreementStatusSchema>;
export type CalendarScope = z.infer<typeof calendarScopeSchema>;
export type CalendarView = z.infer<typeof calendarViewSchema>;
export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;
export type ExternalCalendarProvider = z.infer<typeof externalCalendarProviderSchema>;
