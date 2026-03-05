--
-- PostgreSQL database dump
--

\restrict aB7Au6VWGhvfFrJNS0khdJQQNUXQqhAHFEUP8GmwocEPjD9HoCWdlG3mQDEUJyJ

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ActionType; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."ActionType" AS ENUM (
    'LOGIN',
    'LOGOUT',
    'CREAR',
    'ACTUALIZAR',
    'ELIMINAR',
    'CAMBIO_ROL',
    'CAMBIO_ESTADO_TAREA',
    'REASIGNAR_TAREA',
    'APROBAR_SOLICITUD',
    'CAMBIO_PERMISO',
    'PROGRAMAR_REUNION',
    'REGISTRAR_ACUERDO'
);


ALTER TYPE public."ActionType" OWNER TO corelia;

--
-- Name: AuditCodeField; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."AuditCodeField" AS ENUM (
    'AUDIT_REASON'
);


ALTER TYPE public."AuditCodeField" OWNER TO corelia;

--
-- Name: AutomationAction; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."AutomationAction" AS ENUM (
    'ENVIAR_NOTIFICACION',
    'CREAR_AUDITORIA',
    'CAMBIAR_ESTADO_TAREA'
);


ALTER TYPE public."AutomationAction" OWNER TO corelia;

--
-- Name: AutomationEvent; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."AutomationEvent" AS ENUM (
    'TAREA_COMPLETADA',
    'TAREA_SIN_MOVIMIENTO',
    'TAREA_REASIGNADA',
    'TAREA_VENCIDA',
    'SOLICITUD_RESUELTA'
);


ALTER TYPE public."AutomationEvent" OWNER TO corelia;

--
-- Name: AvailabilityType; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."AvailabilityType" AS ENUM (
    'VACACIONES',
    'PERMISO',
    'AUSENCIA',
    'NO_DISPONIBLE'
);


ALTER TYPE public."AvailabilityType" OWNER TO corelia;

--
-- Name: ChannelScope; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."ChannelScope" AS ENUM (
    'EQUIPO',
    'PROYECTO'
);


ALTER TYPE public."ChannelScope" OWNER TO corelia;

--
-- Name: DecisionCodeField; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."DecisionCodeField" AS ENUM (
    'DECISION_DESCRIPTION'
);


ALTER TYPE public."DecisionCodeField" OWNER TO corelia;

--
-- Name: EntityType; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."EntityType" AS ENUM (
    'USUARIO',
    'PROYECTO',
    'TAREA',
    'MENSAJE',
    'ARCHIVO',
    'SOLICITUD',
    'ANUNCIO',
    'OBJETIVO',
    'DECISION',
    'AUTOMATIZACION',
    'REUNION',
    'ACUERDO_REUNION'
);


ALTER TYPE public."EntityType" OWNER TO corelia;

--
-- Name: ExternalCalendarProvider; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."ExternalCalendarProvider" AS ENUM (
    'GOOGLE',
    'MICROSOFT'
);


ALTER TYPE public."ExternalCalendarProvider" OWNER TO corelia;

--
-- Name: FolderScope; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."FolderScope" AS ENUM (
    'EQUIPO',
    'PROYECTO'
);


ALTER TYPE public."FolderScope" OWNER TO corelia;

--
-- Name: GuestResourceType; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."GuestResourceType" AS ENUM (
    'PROYECTO',
    'ARCHIVO',
    'DOCUMENTO'
);


ALTER TYPE public."GuestResourceType" OWNER TO corelia;

--
-- Name: IdentityCodeField; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."IdentityCodeField" AS ENUM (
    'OFFBOARDING_REASON'
);


ALTER TYPE public."IdentityCodeField" OWNER TO corelia;

--
-- Name: ImportSource; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."ImportSource" AS ENUM (
    'CSV',
    'TRELLO_JSON',
    'NOTION_CSV'
);


ALTER TYPE public."ImportSource" OWNER TO corelia;

--
-- Name: MeetingAgreementStatus; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."MeetingAgreementStatus" AS ENUM (
    'PENDIENTE_ACCION',
    'VINCULADO_TAREA',
    'COMPLETADO'
);


ALTER TYPE public."MeetingAgreementStatus" OWNER TO corelia;

--
-- Name: MeetingCodeField; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."MeetingCodeField" AS ENUM (
    'MEETING_DESCRIPTION',
    'MEETING_AGREEMENT_DESCRIPTION'
);


ALTER TYPE public."MeetingCodeField" OWNER TO corelia;

--
-- Name: MeetingStatus; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."MeetingStatus" AS ENUM (
    'PROGRAMADA',
    'EN_CURSO',
    'FINALIZADA',
    'CANCELADA'
);


ALTER TYPE public."MeetingStatus" OWNER TO corelia;

--
-- Name: NotificationChannel; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."NotificationChannel" AS ENUM (
    'EMAIL',
    'IN_APP'
);


ALTER TYPE public."NotificationChannel" OWNER TO corelia;

--
-- Name: NotificationEvent; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."NotificationEvent" AS ENUM (
    'TAREA_ASIGNADA',
    'TAREA_REASIGNADA',
    'TAREA_ESTADO_CAMBIADO',
    'MENCION_MENSAJE',
    'TAREA_PROXIMA_VENCER',
    'TAREA_BLOQUEADA',
    'SOLICITUD_RESUELTA',
    'MENSAJE_NUEVO_CANAL',
    'REUNION_PROGRAMADA',
    'ACUERDO_ASIGNADO_TAREA'
);


ALTER TYPE public."NotificationEvent" OWNER TO corelia;

--
-- Name: NotificationFrequency; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."NotificationFrequency" AS ENUM (
    'INMEDIATA',
    'RESUMEN_DIARIO'
);


ALTER TYPE public."NotificationFrequency" OWNER TO corelia;

--
-- Name: ObjectiveCodeField; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."ObjectiveCodeField" AS ENUM (
    'OBJECTIVE_DESCRIPTION'
);


ALTER TYPE public."ObjectiveCodeField" OWNER TO corelia;

--
-- Name: ObjectiveScope; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."ObjectiveScope" AS ENUM (
    'EQUIPO',
    'PROYECTO'
);


ALTER TYPE public."ObjectiveScope" OWNER TO corelia;

--
-- Name: ProjectCodeField; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."ProjectCodeField" AS ENUM (
    'PROJECT_DESCRIPTION'
);


ALTER TYPE public."ProjectCodeField" OWNER TO corelia;

--
-- Name: ProjectTemplate; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."ProjectTemplate" AS ENUM (
    'SOFTWARE',
    'CONTENIDO',
    'OPERACIONES'
);


ALTER TYPE public."ProjectTemplate" OWNER TO corelia;

--
-- Name: RequestStatus; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."RequestStatus" AS ENUM (
    'PENDIENTE',
    'APROBADA',
    'RECHAZADA'
);


ALTER TYPE public."RequestStatus" OWNER TO corelia;

--
-- Name: RequestType; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."RequestType" AS ENUM (
    'VACACIONES',
    'PERMISO',
    'ACCESO_RECURSO'
);


ALTER TYPE public."RequestType" OWNER TO corelia;

--
-- Name: StorageQuotaScope; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."StorageQuotaScope" AS ENUM (
    'USUARIO',
    'EQUIPO'
);


ALTER TYPE public."StorageQuotaScope" OWNER TO corelia;

--
-- Name: SystemRole; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."SystemRole" AS ENUM (
    'ADMINISTRADOR',
    'LIDER_PROYECTO',
    'COORDINADOR_EQUIPO',
    'COLABORADOR',
    'OBSERVADOR',
    'INVITADO_EXTERNO'
);


ALTER TYPE public."SystemRole" OWNER TO corelia;

--
-- Name: TaskCodeField; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."TaskCodeField" AS ENUM (
    'TASK_DESCRIPTION',
    'TASK_BLOCKED_REASON',
    'TASK_STATUS_REASON',
    'TASK_REASSIGN_REASON',
    'TASK_SCHEDULE_REASON'
);


ALTER TYPE public."TaskCodeField" OWNER TO corelia;

--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'BACKLOG',
    'PENDIENTE',
    'EN_PROGRESO',
    'EN_REVISION',
    'BLOQUEADA',
    'COMPLETADA',
    'CANCELADA'
);


ALTER TYPE public."TaskStatus" OWNER TO corelia;

--
-- Name: TeamCodeField; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."TeamCodeField" AS ENUM (
    'TEAM_DESCRIPTION'
);


ALTER TYPE public."TeamCodeField" OWNER TO corelia;

--
-- Name: WebhookEvent; Type: TYPE; Schema: public; Owner: corelia
--

CREATE TYPE public."WebhookEvent" AS ENUM (
    'TAREA_COMPLETADA',
    'SOLICITUD_APROBADA',
    'SOLICITUD_RECHAZADA',
    'TAREA_REASIGNADA',
    'TAREA_VENCIDA'
);


ALTER TYPE public."WebhookEvent" OWNER TO corelia;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Announcement; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Announcement" (
    id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    "allCompany" boolean DEFAULT false NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Announcement" OWNER TO corelia;

--
-- Name: AnnouncementTeam; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."AnnouncementTeam" (
    id uuid NOT NULL,
    "announcementId" uuid NOT NULL,
    "teamId" uuid NOT NULL
);


ALTER TABLE public."AnnouncementTeam" OWNER TO corelia;

--
-- Name: AnnouncementUser; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."AnnouncementUser" (
    id uuid NOT NULL,
    "announcementId" uuid NOT NULL,
    "userId" uuid NOT NULL
);


ALTER TABLE public."AnnouncementUser" OWNER TO corelia;

--
-- Name: AuditCodeCatalog; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."AuditCodeCatalog" (
    id uuid NOT NULL,
    field public."AuditCodeField" NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AuditCodeCatalog" OWNER TO corelia;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."AuditLog" (
    id uuid NOT NULL,
    "entityType" public."EntityType" NOT NULL,
    "entityId" uuid NOT NULL,
    action public."ActionType" NOT NULL,
    "userId" uuid,
    "previousData" jsonb,
    "newData" jsonb,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reasonCode" text
);


ALTER TABLE public."AuditLog" OWNER TO corelia;

--
-- Name: AutomationRule; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."AutomationRule" (
    id uuid NOT NULL,
    "projectId" uuid NOT NULL,
    name text NOT NULL,
    event public."AutomationEvent" NOT NULL,
    action public."AutomationAction" NOT NULL,
    config jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AutomationRule" OWNER TO corelia;

--
-- Name: AvailabilityBlock; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."AvailabilityBlock" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    type public."AvailabilityType" NOT NULL,
    "startAt" timestamp(3) without time zone NOT NULL,
    "endAt" timestamp(3) without time zone NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AvailabilityBlock" OWNER TO corelia;

--
-- Name: Channel; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Channel" (
    id uuid NOT NULL,
    name text NOT NULL,
    scope public."ChannelScope" NOT NULL,
    "teamId" uuid,
    "projectId" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Channel" OWNER TO corelia;

--
-- Name: ChannelMember; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ChannelMember" (
    id uuid NOT NULL,
    "channelId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ChannelMember" OWNER TO corelia;

--
-- Name: DecisionCodeCatalog; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."DecisionCodeCatalog" (
    id uuid NOT NULL,
    field public."DecisionCodeField" NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."DecisionCodeCatalog" OWNER TO corelia;

--
-- Name: DecisionNote; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."DecisionNote" (
    id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "authorId" uuid NOT NULL,
    "linkedEntityType" public."EntityType" NOT NULL,
    "linkedEntityId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "descriptionCode" text
);


ALTER TABLE public."DecisionNote" OWNER TO corelia;

--
-- Name: ExternalCalendarConnection; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ExternalCalendarConnection" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    provider public."ExternalCalendarProvider" NOT NULL,
    "externalAccountId" text NOT NULL,
    "accessTokenEncrypted" text NOT NULL,
    "refreshTokenEncrypted" text,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ExternalCalendarConnection" OWNER TO corelia;

--
-- Name: ExternalCalendarEvent; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ExternalCalendarEvent" (
    id uuid NOT NULL,
    "connectionId" uuid NOT NULL,
    "externalId" text NOT NULL,
    title text NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    "readOnly" boolean DEFAULT true NOT NULL,
    "projectId" uuid,
    "teamId" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ExternalCalendarEvent" OWNER TO corelia;

--
-- Name: FileObject; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."FileObject" (
    id uuid NOT NULL,
    "folderId" uuid NOT NULL,
    "ownerId" uuid NOT NULL,
    "originalName" text NOT NULL,
    "mimeType" text NOT NULL,
    "sizeBytes" integer NOT NULL,
    "minioPath" text NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FileObject" OWNER TO corelia;

--
-- Name: FileTrash; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."FileTrash" (
    id uuid NOT NULL,
    "fileId" uuid NOT NULL,
    "scheduledPurgeAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FileTrash" OWNER TO corelia;

--
-- Name: Folder; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Folder" (
    id uuid NOT NULL,
    name text NOT NULL,
    scope public."FolderScope" NOT NULL,
    "teamId" uuid,
    "projectId" uuid,
    "parentId" uuid,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Folder" OWNER TO corelia;

--
-- Name: FormRequest; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."FormRequest" (
    id uuid NOT NULL,
    "requesterId" uuid NOT NULL,
    type public."RequestType" NOT NULL,
    payload jsonb NOT NULL,
    status public."RequestStatus" DEFAULT 'PENDIENTE'::public."RequestStatus" NOT NULL,
    "approverId" uuid,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."FormRequest" OWNER TO corelia;

--
-- Name: GuestInvite; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."GuestInvite" (
    id uuid NOT NULL,
    email text NOT NULL,
    "tokenHash" text NOT NULL,
    "resourceType" public."GuestResourceType" NOT NULL,
    "resourceId" uuid NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdById" uuid NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."GuestInvite" OWNER TO corelia;

--
-- Name: IdentityCodeCatalog; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."IdentityCodeCatalog" (
    id uuid NOT NULL,
    field public."IdentityCodeField" NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."IdentityCodeCatalog" OWNER TO corelia;

--
-- Name: ImportError; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ImportError" (
    id uuid NOT NULL,
    "jobId" uuid NOT NULL,
    "rowNumber" integer NOT NULL,
    field text NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ImportError" OWNER TO corelia;

--
-- Name: ImportJob; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ImportJob" (
    id uuid NOT NULL,
    source public."ImportSource" NOT NULL,
    filename text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "finishedAt" timestamp(3) without time zone,
    success boolean DEFAULT false NOT NULL,
    "createdById" uuid NOT NULL
);


ALTER TABLE public."ImportJob" OWNER TO corelia;

--
-- Name: InternalInvite; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."InternalInvite" (
    id uuid NOT NULL,
    email text NOT NULL,
    "tokenHash" text NOT NULL,
    "baseRole" public."SystemRole" NOT NULL,
    "teamId" uuid,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdById" uuid NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resentAt" timestamp(3) without time zone
);


ALTER TABLE public."InternalInvite" OWNER TO corelia;

--
-- Name: MaintenanceMode; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."MaintenanceMode" (
    id integer DEFAULT 1 NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    message text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MaintenanceMode" OWNER TO corelia;

--
-- Name: Meeting; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Meeting" (
    id uuid NOT NULL,
    title text NOT NULL,
    description text,
    "projectId" uuid,
    "teamId" uuid,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    "createdById" uuid NOT NULL,
    status public."MeetingStatus" DEFAULT 'PROGRAMADA'::public."MeetingStatus" NOT NULL,
    "mediaRoomId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "descriptionCode" text
);


ALTER TABLE public."Meeting" OWNER TO corelia;

--
-- Name: MeetingAgendaItem; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."MeetingAgendaItem" (
    id uuid NOT NULL,
    "meetingId" uuid NOT NULL,
    text text NOT NULL,
    "order" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."MeetingAgendaItem" OWNER TO corelia;

--
-- Name: MeetingAgreement; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."MeetingAgreement" (
    id uuid NOT NULL,
    "meetingId" uuid NOT NULL,
    title text NOT NULL,
    description text,
    status public."MeetingAgreementStatus" DEFAULT 'PENDIENTE_ACCION'::public."MeetingAgreementStatus" NOT NULL,
    "authorId" uuid NOT NULL,
    "taskId" uuid,
    "createdTask" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "descriptionCode" text
);


ALTER TABLE public."MeetingAgreement" OWNER TO corelia;

--
-- Name: MeetingCodeCatalog; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."MeetingCodeCatalog" (
    id uuid NOT NULL,
    field public."MeetingCodeField" NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MeetingCodeCatalog" OWNER TO corelia;

--
-- Name: MeetingNote; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."MeetingNote" (
    id uuid NOT NULL,
    "meetingId" uuid NOT NULL,
    "authorId" uuid NOT NULL,
    content jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MeetingNote" OWNER TO corelia;

--
-- Name: MeetingParticipant; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."MeetingParticipant" (
    id uuid NOT NULL,
    "meetingId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role public."SystemRole",
    muted boolean DEFAULT false NOT NULL,
    "cameraOn" boolean DEFAULT true NOT NULL,
    "screenSharing" boolean DEFAULT false NOT NULL,
    speaking boolean DEFAULT false NOT NULL,
    "joinedAt" timestamp(3) without time zone,
    "leftAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."MeetingParticipant" OWNER TO corelia;

--
-- Name: Message; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Message" (
    id uuid NOT NULL,
    "channelId" uuid NOT NULL,
    "authorId" uuid NOT NULL,
    content text NOT NULL,
    mentions text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Message" OWNER TO corelia;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Notification" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    event public."NotificationEvent" NOT NULL,
    channel public."NotificationChannel" NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveredAt" timestamp(3) without time zone,
    "readAt" timestamp(3) without time zone
);


ALTER TABLE public."Notification" OWNER TO corelia;

--
-- Name: NotificationPreference; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."NotificationPreference" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    event public."NotificationEvent" NOT NULL,
    channel public."NotificationChannel" NOT NULL,
    frequency public."NotificationFrequency" NOT NULL,
    enabled boolean DEFAULT true NOT NULL
);


ALTER TABLE public."NotificationPreference" OWNER TO corelia;

--
-- Name: Objective; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Objective" (
    id uuid NOT NULL,
    scope public."ObjectiveScope" NOT NULL,
    "teamId" uuid,
    "projectId" uuid,
    title text NOT NULL,
    description text,
    "ownerId" uuid NOT NULL,
    "targetDate" timestamp(3) without time zone NOT NULL,
    "progressPct" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "descriptionCode" text
);


ALTER TABLE public."Objective" OWNER TO corelia;

--
-- Name: ObjectiveCodeCatalog; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ObjectiveCodeCatalog" (
    id uuid NOT NULL,
    field public."ObjectiveCodeField" NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ObjectiveCodeCatalog" OWNER TO corelia;

--
-- Name: ObjectiveTask; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ObjectiveTask" (
    id uuid NOT NULL,
    "objectiveId" uuid NOT NULL,
    "taskId" uuid NOT NULL
);


ALTER TABLE public."ObjectiveTask" OWNER TO corelia;

--
-- Name: OffboardingRecord; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."OffboardingRecord" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "transferToUserId" uuid NOT NULL,
    reason text NOT NULL,
    "revokedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "archivedAt" timestamp(3) without time zone,
    "reasonCode" text
);


ALTER TABLE public."OffboardingRecord" OWNER TO corelia;

--
-- Name: OnboardingChecklist; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."OnboardingChecklist" (
    id uuid NOT NULL,
    name text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."OnboardingChecklist" OWNER TO corelia;

--
-- Name: OnboardingChecklistItem; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."OnboardingChecklistItem" (
    id uuid NOT NULL,
    "checklistId" uuid NOT NULL,
    "stepKey" text NOT NULL,
    label text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    "order" integer NOT NULL
);


ALTER TABLE public."OnboardingChecklistItem" OWNER TO corelia;

--
-- Name: OnboardingRun; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."OnboardingRun" (
    id uuid NOT NULL,
    "checklistId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone
);


ALTER TABLE public."OnboardingRun" OWNER TO corelia;

--
-- Name: OnboardingRunStep; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."OnboardingRunStep" (
    id uuid NOT NULL,
    "runId" uuid NOT NULL,
    "stepKey" text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    "completedAt" timestamp(3) without time zone
);


ALTER TABLE public."OnboardingRunStep" OWNER TO corelia;

--
-- Name: PersonProfile; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."PersonProfile" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "internalContactEmail" text NOT NULL,
    "internalPhone" text,
    skills text[],
    timezone text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PersonProfile" OWNER TO corelia;

--
-- Name: Project; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Project" (
    id uuid NOT NULL,
    name text NOT NULL,
    description text,
    template public."ProjectTemplate" NOT NULL,
    "ownerId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "descriptionCode" text
);


ALTER TABLE public."Project" OWNER TO corelia;

--
-- Name: ProjectCodeCatalog; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ProjectCodeCatalog" (
    id uuid NOT NULL,
    field public."ProjectCodeField" NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectCodeCatalog" OWNER TO corelia;

--
-- Name: ProjectMember; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ProjectMember" (
    id uuid NOT NULL,
    "projectId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role public."SystemRole" NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ProjectMember" OWNER TO corelia;

--
-- Name: ProjectStage; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."ProjectStage" (
    id uuid NOT NULL,
    "projectId" uuid NOT NULL,
    name text NOT NULL,
    "order" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    code text NOT NULL,
    color text DEFAULT '#4F7CFF'::text NOT NULL
);


ALTER TABLE public."ProjectStage" OWNER TO corelia;

--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."RefreshToken" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "rotatedFromId" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."RefreshToken" OWNER TO corelia;

--
-- Name: StorageQuota; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."StorageQuota" (
    id uuid NOT NULL,
    "scopeType" public."StorageQuotaScope" NOT NULL,
    "scopeId" uuid NOT NULL,
    "bytesLimit" bigint NOT NULL,
    "alertThresholdPct" double precision DEFAULT 0.8 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."StorageQuota" OWNER TO corelia;

--
-- Name: Task; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Task" (
    id uuid NOT NULL,
    "projectId" uuid NOT NULL,
    title text NOT NULL,
    description text,
    "assigneeId" uuid,
    "createdById" uuid NOT NULL,
    status public."TaskStatus" DEFAULT 'BACKLOG'::public."TaskStatus" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "blockingTaskId" uuid,
    "blockedReason" text,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "startDate" timestamp(3) without time zone,
    "stageId" uuid,
    "blockedReasonCode" text,
    "descriptionCode" text
);


ALTER TABLE public."Task" OWNER TO corelia;

--
-- Name: TaskCodeCatalog; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."TaskCodeCatalog" (
    id uuid NOT NULL,
    field public."TaskCodeField" NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TaskCodeCatalog" OWNER TO corelia;

--
-- Name: TaskDependency; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."TaskDependency" (
    id uuid NOT NULL,
    "taskId" uuid NOT NULL,
    "dependsOnTaskId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TaskDependency" OWNER TO corelia;

--
-- Name: TaskReassignment; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."TaskReassignment" (
    id uuid NOT NULL,
    "taskId" uuid NOT NULL,
    "previousAssigneeId" uuid,
    "newAssigneeId" uuid NOT NULL,
    reason text NOT NULL,
    "reassignedById" uuid NOT NULL,
    "reassignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reasonCode" text
);


ALTER TABLE public."TaskReassignment" OWNER TO corelia;

--
-- Name: TaskScheduleHistory; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."TaskScheduleHistory" (
    id uuid NOT NULL,
    "taskId" uuid NOT NULL,
    "previousStartDate" timestamp(3) without time zone,
    "previousDueDate" timestamp(3) without time zone,
    "newStartDate" timestamp(3) without time zone,
    "newDueDate" timestamp(3) without time zone,
    reason text NOT NULL,
    "changedById" uuid NOT NULL,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reasonCode" text
);


ALTER TABLE public."TaskScheduleHistory" OWNER TO corelia;

--
-- Name: TaskStatusHistory; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."TaskStatusHistory" (
    id uuid NOT NULL,
    "taskId" uuid NOT NULL,
    "fromStatus" public."TaskStatus",
    "toStatus" public."TaskStatus" NOT NULL,
    reason text NOT NULL,
    "changedById" uuid NOT NULL,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reasonCode" text
);


ALTER TABLE public."TaskStatusHistory" OWNER TO corelia;

--
-- Name: Team; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."Team" (
    id uuid NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "descriptionCode" text
);


ALTER TABLE public."Team" OWNER TO corelia;

--
-- Name: TeamCodeCatalog; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."TeamCodeCatalog" (
    id uuid NOT NULL,
    field public."TeamCodeField" NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TeamCodeCatalog" OWNER TO corelia;

--
-- Name: TeamMember; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."TeamMember" (
    id uuid NOT NULL,
    "teamId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TeamMember" OWNER TO corelia;

--
-- Name: TimeEntry; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."TimeEntry" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "taskId" uuid NOT NULL,
    minutes integer NOT NULL,
    note text,
    "loggedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TimeEntry" OWNER TO corelia;

--
-- Name: User; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."User" (
    id uuid NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "baseRole" public."SystemRole" DEFAULT 'COLABORADOR'::public."SystemRole" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deactivatedAt" timestamp(3) without time zone
);


ALTER TABLE public."User" OWNER TO corelia;

--
-- Name: WebhookDelivery; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."WebhookDelivery" (
    id uuid NOT NULL,
    "endpointId" uuid NOT NULL,
    payload jsonb NOT NULL,
    "statusCode" integer,
    success boolean DEFAULT false NOT NULL,
    "attemptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."WebhookDelivery" OWNER TO corelia;

--
-- Name: WebhookEndpoint; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."WebhookEndpoint" (
    id uuid NOT NULL,
    url text NOT NULL,
    event public."WebhookEvent" NOT NULL,
    secret text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."WebhookEndpoint" OWNER TO corelia;

--
-- Name: WorkSchedule; Type: TABLE; Schema: public; Owner: corelia
--

CREATE TABLE public."WorkSchedule" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    timezone text NOT NULL,
    "weekDays" integer[],
    "startHour" text NOT NULL,
    "endHour" text NOT NULL,
    "maxActiveTasks" integer DEFAULT 5 NOT NULL,
    "periodHoursCapacity" double precision DEFAULT 40 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."WorkSchedule" OWNER TO corelia;

--
-- Data for Name: Announcement; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Announcement" (id, title, body, "allCompany", "expiresAt", "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: AnnouncementTeam; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."AnnouncementTeam" (id, "announcementId", "teamId") FROM stdin;
\.


--
-- Data for Name: AnnouncementUser; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."AnnouncementUser" (id, "announcementId", "userId") FROM stdin;
\.


--
-- Data for Name: AuditCodeCatalog; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."AuditCodeCatalog" (id, field, code, label, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."AuditLog" (id, "entityType", "entityId", action, "userId", "previousData", "newData", reason, "createdAt", "reasonCode") FROM stdin;
b7a09037-7444-48c4-902f-275f8ab0432c	USUARIO	1bec814d-558c-4260-a533-de863a605404	CREAR	\N	\N	{"id": "1bec814d-558c-4260-a533-de863a605404", "email": "admin2@corelia.local", "baseRole": "ADMINISTRADOR", "lastName": "Corelia", "firstName": "Admin2"}	\N	2026-03-03 18:49:31.151	\N
02658333-0a27-488e-ad43-54e957334cfe	USUARIO	27d8bcfa-65ed-49c7-9222-c181dc7616f6	CREAR	\N	\N	{"id": "27d8bcfa-65ed-49c7-9222-c181dc7616f6", "email": "admin@corelia.local", "baseRole": "ADMINISTRADOR", "lastName": "Corelia", "firstName": "Admin"}	\N	2026-03-03 18:49:31.38	\N
0c32194e-f648-46bc-9192-548d026541d5	USUARIO	27d8bcfa-65ed-49c7-9222-c181dc7616f6	LOGIN	\N	\N	\N	\N	2026-03-03 18:50:14.937	\N
7debd9bd-cad7-4e26-a392-d5c64d2b54fb	PROYECTO	2a051ef8-37e8-4f69-b6c7-e449c393e0d4	CREAR	27d8bcfa-65ed-49c7-9222-c181dc7616f6	\N	{"name": "ejemplo", "template": "SOFTWARE"}	\N	2026-03-03 18:50:27.519	\N
f66241ff-1d68-410e-b93a-7e5f8a93822e	USUARIO	e8a971ba-9f2c-41c5-9a98-5f07b8f98b9a	CREAR	27d8bcfa-65ed-49c7-9222-c181dc7616f6	\N	{"name": "rv"}	\N	2026-03-03 18:50:52.803	\N
e0a8f76f-0d0f-4ef0-805e-6d840e7fb1b8	PROYECTO	2a051ef8-37e8-4f69-b6c7-e449c393e0d4	CAMBIO_ROL	27d8bcfa-65ed-49c7-9222-c181dc7616f6	\N	{"role": "COLABORADOR", "userId": "1bec814d-558c-4260-a533-de863a605404"}	\N	2026-03-03 18:51:05.864	\N
f5dfa11d-1ddd-415f-8047-d454f715bce7	REUNION	9ee95332-2701-448c-8424-84afa3808ab8	PROGRAMAR_REUNION	27d8bcfa-65ed-49c7-9222-c181dc7616f6	\N	{"title": "asd", "endsAt": "2026-03-31T18:51:00.000Z", "teamId": null, "startsAt": "2026-03-03T18:51:00.000Z", "projectId": "2a051ef8-37e8-4f69-b6c7-e449c393e0d4"}	\N	2026-03-03 18:51:30.505	\N
0d58ac9e-488f-4963-8a63-d431c24a5233	USUARIO	1bec814d-558c-4260-a533-de863a605404	LOGIN	\N	\N	\N	\N	2026-03-03 18:52:29.349	\N
033aa17b-0b2d-4046-af9b-4c191c09d972	USUARIO	1bec814d-558c-4260-a533-de863a605404	LOGIN	\N	\N	\N	\N	2026-03-03 19:12:22.656	\N
62e5836c-d22d-454c-ac96-34b0f7ca9cc9	USUARIO	27d8bcfa-65ed-49c7-9222-c181dc7616f6	LOGIN	\N	\N	\N	\N	2026-03-03 19:12:46.858	\N
5512c765-9791-4d42-9ee3-9078eeb27ac9	TAREA	1483a6a7-67e1-4363-bbf9-c88fd8c1d639	CREAR	1bec814d-558c-4260-a533-de863a605404	\N	{"title": "primera tarea", "projectId": "2a051ef8-37e8-4f69-b6c7-e449c393e0d4", "assigneeId": "27d8bcfa-65ed-49c7-9222-c181dc7616f6"}	\N	2026-03-03 19:21:29.609	\N
694fdefb-84ae-4741-b796-f540ad4e00ba	USUARIO	1bec814d-558c-4260-a533-de863a605404	LOGIN	\N	\N	\N	\N	2026-03-03 19:47:16.236	\N
3ab2b992-523c-4e6a-b9d1-68025d772847	TAREA	1483a6a7-67e1-4363-bbf9-c88fd8c1d639	ACTUALIZAR	1bec814d-558c-4260-a533-de863a605404	\N	{"dueDate": "2026-03-05T19:21:00.000Z", "startDate": "2026-03-04T19:21:00.000Z"}	Ajuste desde vista Gantt	2026-03-03 19:47:28.457	\N
3bec5d23-70a0-48ff-bb73-903919f1d235	TAREA	1483a6a7-67e1-4363-bbf9-c88fd8c1d639	ACTUALIZAR	1bec814d-558c-4260-a533-de863a605404	\N	{"dueDate": "2026-03-04T19:21:00.000Z", "startDate": "2026-03-03T19:21:00.000Z"}	Ajuste desde vista Gantt	2026-03-03 19:47:32.759	\N
62fc0e05-56ed-49f4-a3c3-c84a235fcc48	TAREA	1483a6a7-67e1-4363-bbf9-c88fd8c1d639	ACTUALIZAR	1bec814d-558c-4260-a533-de863a605404	\N	{"dueDate": "2026-03-05T19:21:00.000Z", "startDate": "2026-03-03T19:21:00.000Z"}	Ajuste desde vista Gantt	2026-03-03 19:47:38.396	\N
b13b09cb-3d2b-4a68-bbc8-2ea4e5afc83b	TAREA	1483a6a7-67e1-4363-bbf9-c88fd8c1d639	ACTUALIZAR	1bec814d-558c-4260-a533-de863a605404	\N	{"dueDate": "2026-03-06T19:21:00.000Z", "startDate": "2026-03-03T19:21:00.000Z"}	Ajuste desde vista Gantt	2026-03-03 19:47:42.664	\N
f50d729e-7407-4b46-a4fb-04d868d65c1f	USUARIO	1bec814d-558c-4260-a533-de863a605404	LOGIN	\N	\N	\N	\N	2026-03-03 20:23:05.782	\N
6902ada6-df74-413d-b37d-a6230b7204ef	USUARIO	27d8bcfa-65ed-49c7-9222-c181dc7616f6	LOGIN	\N	\N	\N	\N	2026-03-03 20:24:16.152	\N
f3d11bc2-c905-4125-a817-c0744b565c78	USUARIO	1bec814d-558c-4260-a533-de863a605404	LOGIN	\N	\N	\N	\N	2026-03-04 12:58:53.416	\N
f14eb3cb-e927-4364-8ba2-527760315dab	USUARIO	27d8bcfa-65ed-49c7-9222-c181dc7616f6	LOGIN	\N	\N	\N	\N	2026-03-04 12:58:53.636	\N
5c6a2379-6b63-47df-8aaa-4e48274b38d1	USUARIO	1bec814d-558c-4260-a533-de863a605404	LOGIN	\N	\N	\N	\N	2026-03-04 14:05:29.523	\N
07b4452e-d086-42b8-869a-28d4e14c55f5	USUARIO	27d8bcfa-65ed-49c7-9222-c181dc7616f6	LOGIN	\N	\N	\N	\N	2026-03-04 14:17:13.05	\N
0d308361-5432-4da3-b675-bf9f4a87d6b0	USUARIO	27d8bcfa-65ed-49c7-9222-c181dc7616f6	LOGIN	\N	\N	\N	\N	2026-03-04 14:53:09.467	\N
\.


--
-- Data for Name: AutomationRule; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."AutomationRule" (id, "projectId", name, event, action, config, enabled, "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: AvailabilityBlock; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."AvailabilityBlock" (id, "userId", type, "startAt", "endAt", note, "createdAt") FROM stdin;
\.


--
-- Data for Name: Channel; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Channel" (id, name, scope, "teamId", "projectId", "createdAt") FROM stdin;
c698afab-67b7-442c-a59f-a5459d713fb1	ejemplo · General	PROYECTO	\N	2a051ef8-37e8-4f69-b6c7-e449c393e0d4	2026-03-04 14:53:19.93
\.


--
-- Data for Name: ChannelMember; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ChannelMember" (id, "channelId", "userId", "joinedAt") FROM stdin;
e80685c8-0f34-475b-93ae-63fa6b7d9bbb	c698afab-67b7-442c-a59f-a5459d713fb1	27d8bcfa-65ed-49c7-9222-c181dc7616f6	2026-03-04 14:53:19.93
5181b65e-6cd4-4656-ae8c-d94a050b9936	c698afab-67b7-442c-a59f-a5459d713fb1	1bec814d-558c-4260-a533-de863a605404	2026-03-04 14:53:19.93
\.


--
-- Data for Name: DecisionCodeCatalog; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."DecisionCodeCatalog" (id, field, code, label, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: DecisionNote; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."DecisionNote" (id, title, description, "authorId", "linkedEntityType", "linkedEntityId", "createdAt", "descriptionCode") FROM stdin;
\.


--
-- Data for Name: ExternalCalendarConnection; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ExternalCalendarConnection" (id, "userId", provider, "externalAccountId", "accessTokenEncrypted", "refreshTokenEncrypted", "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ExternalCalendarEvent; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ExternalCalendarEvent" (id, "connectionId", "externalId", title, "startsAt", "endsAt", "readOnly", "projectId", "teamId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: FileObject; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."FileObject" (id, "folderId", "ownerId", "originalName", "mimeType", "sizeBytes", "minioPath", "deletedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: FileTrash; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."FileTrash" (id, "fileId", "scheduledPurgeAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: Folder; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Folder" (id, name, scope, "teamId", "projectId", "parentId", "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: FormRequest; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."FormRequest" (id, "requesterId", type, payload, status, "approverId", comment, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: GuestInvite; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."GuestInvite" (id, email, "tokenHash", "resourceType", "resourceId", "expiresAt", "createdById", "acceptedAt", "revokedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: IdentityCodeCatalog; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."IdentityCodeCatalog" (id, field, code, label, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ImportError; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ImportError" (id, "jobId", "rowNumber", field, message, "createdAt") FROM stdin;
\.


--
-- Data for Name: ImportJob; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ImportJob" (id, source, filename, "startedAt", "finishedAt", success, "createdById") FROM stdin;
\.


--
-- Data for Name: InternalInvite; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."InternalInvite" (id, email, "tokenHash", "baseRole", "teamId", "expiresAt", "createdById", "acceptedAt", "revokedAt", "createdAt", "resentAt") FROM stdin;
\.


--
-- Data for Name: MaintenanceMode; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."MaintenanceMode" (id, enabled, message, "updatedAt") FROM stdin;
\.


--
-- Data for Name: Meeting; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Meeting" (id, title, description, "projectId", "teamId", "startsAt", "endsAt", "createdById", status, "mediaRoomId", "createdAt", "updatedAt", "descriptionCode") FROM stdin;
9ee95332-2701-448c-8424-84afa3808ab8	asd	asd	2a051ef8-37e8-4f69-b6c7-e449c393e0d4	\N	2026-03-03 18:51:00	2026-03-31 18:51:00	27d8bcfa-65ed-49c7-9222-c181dc7616f6	PROGRAMADA	\N	2026-03-03 18:51:30.479	2026-03-03 18:51:30.479	\N
\.


--
-- Data for Name: MeetingAgendaItem; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."MeetingAgendaItem" (id, "meetingId", text, "order", "createdAt") FROM stdin;
\.


--
-- Data for Name: MeetingAgreement; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."MeetingAgreement" (id, "meetingId", title, description, status, "authorId", "taskId", "createdTask", "createdAt", "updatedAt", "descriptionCode") FROM stdin;
\.


--
-- Data for Name: MeetingCodeCatalog; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."MeetingCodeCatalog" (id, field, code, label, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: MeetingNote; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."MeetingNote" (id, "meetingId", "authorId", content, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: MeetingParticipant; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."MeetingParticipant" (id, "meetingId", "userId", role, muted, "cameraOn", "screenSharing", speaking, "joinedAt", "leftAt", "createdAt") FROM stdin;
3bc5a298-7213-4ecc-a56d-8d4d34af2548	9ee95332-2701-448c-8424-84afa3808ab8	1bec814d-558c-4260-a533-de863a605404	\N	t	t	f	f	2026-03-03 19:13:09.434	2026-03-03 19:15:59.57	2026-03-03 18:51:30.479
3a3e7f05-0486-45f9-93bd-a3bc14c7e75d	9ee95332-2701-448c-8424-84afa3808ab8	27d8bcfa-65ed-49c7-9222-c181dc7616f6	\N	f	t	f	f	2026-03-03 19:12:59.826	2026-03-03 19:16:03.082	2026-03-03 18:51:30.479
\.


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Message" (id, "channelId", "authorId", content, mentions, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Notification" (id, "userId", event, channel, title, body, "sentAt", "createdAt", "deliveredAt", "readAt") FROM stdin;
91f35690-2321-4f28-9f2d-a21f4a52e54f	1bec814d-558c-4260-a533-de863a605404	REUNION_PROGRAMADA	IN_APP	Nueva reunión programada	asd - 2026-03-03T18:51:00.000Z	2026-03-03 18:51:30.579	2026-03-03 18:51:30.489	2026-03-03 18:52:29.484	\N
e08d16e7-4fe0-40e3-931c-de604e6d9599	27d8bcfa-65ed-49c7-9222-c181dc7616f6	TAREA_ASIGNADA	IN_APP	Nueva tarea asignada	Se te asignó la tarea primera tarea	2026-03-03 19:21:29.704	2026-03-03 19:21:29.591	2026-03-03 20:24:16.198	\N
\.


--
-- Data for Name: NotificationPreference; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."NotificationPreference" (id, "userId", event, channel, frequency, enabled) FROM stdin;
\.


--
-- Data for Name: Objective; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Objective" (id, scope, "teamId", "projectId", title, description, "ownerId", "targetDate", "progressPct", "createdAt", "descriptionCode") FROM stdin;
\.


--
-- Data for Name: ObjectiveCodeCatalog; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ObjectiveCodeCatalog" (id, field, code, label, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ObjectiveTask; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ObjectiveTask" (id, "objectiveId", "taskId") FROM stdin;
\.


--
-- Data for Name: OffboardingRecord; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."OffboardingRecord" (id, "userId", "transferToUserId", reason, "revokedAt", "archivedAt", "reasonCode") FROM stdin;
\.


--
-- Data for Name: OnboardingChecklist; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."OnboardingChecklist" (id, name, "isDefault", "createdAt") FROM stdin;
\.


--
-- Data for Name: OnboardingChecklistItem; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."OnboardingChecklistItem" (id, "checklistId", "stepKey", label, required, "order") FROM stdin;
\.


--
-- Data for Name: OnboardingRun; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."OnboardingRun" (id, "checklistId", "userId", "startedAt", "completedAt") FROM stdin;
\.


--
-- Data for Name: OnboardingRunStep; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."OnboardingRunStep" (id, "runId", "stepKey", completed, "completedAt") FROM stdin;
\.


--
-- Data for Name: PersonProfile; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."PersonProfile" (id, "userId", "internalContactEmail", "internalPhone", skills, timezone, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Project" (id, name, description, template, "ownerId", "createdAt", "updatedAt", "descriptionCode") FROM stdin;
2a051ef8-37e8-4f69-b6c7-e449c393e0d4	ejemplo	asd	SOFTWARE	27d8bcfa-65ed-49c7-9222-c181dc7616f6	2026-03-03 18:50:27.501	2026-03-03 18:50:27.501	\N
\.


--
-- Data for Name: ProjectCodeCatalog; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ProjectCodeCatalog" (id, field, code, label, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ProjectMember; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ProjectMember" (id, "projectId", "userId", role, "joinedAt") FROM stdin;
cd2e0c6e-6d0d-40bb-8d47-704fc6ac6417	2a051ef8-37e8-4f69-b6c7-e449c393e0d4	27d8bcfa-65ed-49c7-9222-c181dc7616f6	LIDER_PROYECTO	2026-03-03 18:50:27.501
be7587e2-125a-4382-b8a2-661481d99f44	2a051ef8-37e8-4f69-b6c7-e449c393e0d4	1bec814d-558c-4260-a533-de863a605404	COLABORADOR	2026-03-03 18:51:05.857
\.


--
-- Data for Name: ProjectStage; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."ProjectStage" (id, "projectId", name, "order", "createdAt", "updatedAt", code, color) FROM stdin;
\.


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."RefreshToken" (id, "userId", "tokenHash", "expiresAt", "revokedAt", "rotatedFromId", "createdAt") FROM stdin;
d1f84d29-d947-4a88-8cf6-bf09137a656f	27d8bcfa-65ed-49c7-9222-c181dc7616f6	4267d151f2b7e78568af842af909c2f73c4ae8564f3c8c5665c4bea634f012a1	2026-04-02 18:50:14.928	\N	\N	2026-03-03 18:50:14.929
c522c700-4e41-441b-ad2b-9bbca2772051	1bec814d-558c-4260-a533-de863a605404	bc5469d5b9774f16373169517b4e703f4d837ab80c6149e859f3ca3237de475b	2026-04-02 18:52:29.342	\N	\N	2026-03-03 18:52:29.343
26bfbefc-c61c-4970-8bb8-954e42783cc4	1bec814d-558c-4260-a533-de863a605404	7382b9d66cc9de71a8744a78fb5b44af6e5de68c7b8335cb9153fd0214db1899	2026-04-02 19:12:22.637	\N	\N	2026-03-03 19:12:22.639
ede115fc-550f-44ea-8b26-34e100efdb72	27d8bcfa-65ed-49c7-9222-c181dc7616f6	b21c3b8421aae126f4c4d8ebcb438d2641d3b64d352a070c1cd9d1634fad0048	2026-04-02 19:12:46.852	\N	\N	2026-03-03 19:12:46.853
0c8dcd93-92d1-47c4-8177-277559c59cff	1bec814d-558c-4260-a533-de863a605404	eb9f5897155336fefbaaa936896f632071776142270f760f2a7d45b8c3035619	2026-04-02 19:47:16.228	\N	\N	2026-03-03 19:47:16.229
d2780af2-67a2-4131-879a-318d969e7d48	1bec814d-558c-4260-a533-de863a605404	d71ee3b342442ab540bf50fa6bce5d3f8c701c6779e451c49fc1ab595e70c058	2026-04-02 20:23:05.762	\N	\N	2026-03-03 20:23:05.763
41d8c208-1f3c-4c0b-b18e-9455a532a5f6	27d8bcfa-65ed-49c7-9222-c181dc7616f6	5740ada4d0615b39c51c81371513d5ce11966c67d9d9baf5cb62e693a3fd4eda	2026-04-02 20:24:16.146	\N	\N	2026-03-03 20:24:16.147
63bb8dc3-6d0e-4286-bd2d-677501b4f311	1bec814d-558c-4260-a533-de863a605404	db775f7bd552493d3c18f2d9121d86e8403ccf5673254439cb46b3d63be9eef6	2026-04-03 12:58:53.405	\N	\N	2026-03-04 12:58:53.406
604da212-9f51-4f97-95ce-59092ea736d9	27d8bcfa-65ed-49c7-9222-c181dc7616f6	d8cb519d30834da7a3028d613ef0ae6ac144682f5477478aeb1eb133f59ee586	2026-04-03 12:58:53.633	\N	\N	2026-03-04 12:58:53.633
aff70332-3460-45e0-8185-a6a5df822024	1bec814d-558c-4260-a533-de863a605404	6b51def0391b79584c73bfb308e0d0e423e32395abbdcb4304f21f68a57bac7e	2026-04-03 13:07:08.83	\N	\N	2026-03-04 13:07:08.831
d4879f4f-1ca9-45d7-bf4e-18b078cdb52f	1bec814d-558c-4260-a533-de863a605404	b8a049a257cf0aacdade5c542d1afd365f435948b1f4e9dadeb1ef6c3729b459	2026-04-03 14:05:29.516	\N	\N	2026-03-04 14:05:29.517
d4439bb0-6ff7-4c80-923a-b174d9e578ef	27d8bcfa-65ed-49c7-9222-c181dc7616f6	16d9a3a0dd3f66683ddd3570f12640286e3ef9a61eefea8ec6ab59e96034f9fd	2026-04-03 14:17:13.043	\N	\N	2026-03-04 14:17:13.044
c375b5b2-e38f-49c5-8fcc-b9f2313d79d8	27d8bcfa-65ed-49c7-9222-c181dc7616f6	d18aad329ce6d68753792f340a20e0476757fb7992c88d4ad9bc527345f242e4	2026-04-03 14:53:09.461	\N	\N	2026-03-04 14:53:09.462
\.


--
-- Data for Name: StorageQuota; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."StorageQuota" (id, "scopeType", "scopeId", "bytesLimit", "alertThresholdPct", "createdAt") FROM stdin;
\.


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Task" (id, "projectId", title, description, "assigneeId", "createdById", status, "dueDate", "blockingTaskId", "blockedReason", "completedAt", "createdAt", "updatedAt", "startDate", "stageId", "blockedReasonCode", "descriptionCode") FROM stdin;
1483a6a7-67e1-4363-bbf9-c88fd8c1d639	2a051ef8-37e8-4f69-b6c7-e449c393e0d4	primera tarea	comienzo	27d8bcfa-65ed-49c7-9222-c181dc7616f6	1bec814d-558c-4260-a533-de863a605404	BACKLOG	2026-03-06 19:21:00	\N	\N	\N	2026-03-03 19:21:29.58	2026-03-03 19:47:42.656	2026-03-03 19:21:00	\N	\N	\N
\.


--
-- Data for Name: TaskCodeCatalog; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."TaskCodeCatalog" (id, field, code, label, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TaskDependency; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."TaskDependency" (id, "taskId", "dependsOnTaskId", "createdAt") FROM stdin;
\.


--
-- Data for Name: TaskReassignment; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."TaskReassignment" (id, "taskId", "previousAssigneeId", "newAssigneeId", reason, "reassignedById", "reassignedAt", "reasonCode") FROM stdin;
\.


--
-- Data for Name: TaskScheduleHistory; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."TaskScheduleHistory" (id, "taskId", "previousStartDate", "previousDueDate", "newStartDate", "newDueDate", reason, "changedById", "changedAt", "reasonCode") FROM stdin;
\.


--
-- Data for Name: TaskStatusHistory; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."TaskStatusHistory" (id, "taskId", "fromStatus", "toStatus", reason, "changedById", "changedAt", "reasonCode") FROM stdin;
\.


--
-- Data for Name: Team; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."Team" (id, name, description, "createdAt", "updatedAt", "descriptionCode") FROM stdin;
e8a971ba-9f2c-41c5-9a98-5f07b8f98b9a	rv	\N	2026-03-03 18:50:52.792	2026-03-03 18:50:52.792	\N
\.


--
-- Data for Name: TeamCodeCatalog; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."TeamCodeCatalog" (id, field, code, label, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TeamMember; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."TeamMember" (id, "teamId", "userId", "createdAt") FROM stdin;
e95c80dc-58f0-43d0-802a-593ad95cc1f7	e8a971ba-9f2c-41c5-9a98-5f07b8f98b9a	27d8bcfa-65ed-49c7-9222-c181dc7616f6	2026-03-03 18:50:52.792
e29aa0ab-1333-4d84-b92d-b0e1885bd245	e8a971ba-9f2c-41c5-9a98-5f07b8f98b9a	1bec814d-558c-4260-a533-de863a605404	2026-03-03 18:50:52.792
\.


--
-- Data for Name: TimeEntry; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."TimeEntry" (id, "userId", "taskId", minutes, note, "loggedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."User" (id, email, "passwordHash", "firstName", "lastName", "baseRole", "isActive", "createdAt", "updatedAt", "deactivatedAt") FROM stdin;
1bec814d-558c-4260-a533-de863a605404	admin2@corelia.local	$2a$12$ThrjBsGAfhMFoYp2pB/ku.LLKLtil.N4Bbo0YbwpooH3DZUvPMsTG	Admin2	Corelia	ADMINISTRADOR	t	2026-03-03 18:49:31.146	2026-03-03 18:49:31.146	\N
27d8bcfa-65ed-49c7-9222-c181dc7616f6	admin@corelia.local	$2a$12$ihVHVZbkdPGyNoIcVEOL8OjRfq/kMkOP3eSVD0g2sKXj1V3E1AFyW	Admin	Corelia	ADMINISTRADOR	t	2026-03-03 18:49:31.374	2026-03-03 18:49:31.374	\N
\.


--
-- Data for Name: WebhookDelivery; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."WebhookDelivery" (id, "endpointId", payload, "statusCode", success, "attemptedAt") FROM stdin;
\.


--
-- Data for Name: WebhookEndpoint; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."WebhookEndpoint" (id, url, event, secret, enabled, "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: WorkSchedule; Type: TABLE DATA; Schema: public; Owner: corelia
--

COPY public."WorkSchedule" (id, "userId", timezone, "weekDays", "startHour", "endHour", "maxActiveTasks", "periodHoursCapacity", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Name: AnnouncementTeam AnnouncementTeam_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AnnouncementTeam"
    ADD CONSTRAINT "AnnouncementTeam_pkey" PRIMARY KEY (id);


--
-- Name: AnnouncementUser AnnouncementUser_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AnnouncementUser"
    ADD CONSTRAINT "AnnouncementUser_pkey" PRIMARY KEY (id);


--
-- Name: Announcement Announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_pkey" PRIMARY KEY (id);


--
-- Name: AuditCodeCatalog AuditCodeCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AuditCodeCatalog"
    ADD CONSTRAINT "AuditCodeCatalog_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AutomationRule AutomationRule_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AutomationRule"
    ADD CONSTRAINT "AutomationRule_pkey" PRIMARY KEY (id);


--
-- Name: AvailabilityBlock AvailabilityBlock_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AvailabilityBlock"
    ADD CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY (id);


--
-- Name: ChannelMember ChannelMember_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ChannelMember"
    ADD CONSTRAINT "ChannelMember_pkey" PRIMARY KEY (id);


--
-- Name: Channel Channel_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Channel"
    ADD CONSTRAINT "Channel_pkey" PRIMARY KEY (id);


--
-- Name: DecisionCodeCatalog DecisionCodeCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."DecisionCodeCatalog"
    ADD CONSTRAINT "DecisionCodeCatalog_pkey" PRIMARY KEY (id);


--
-- Name: DecisionNote DecisionNote_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."DecisionNote"
    ADD CONSTRAINT "DecisionNote_pkey" PRIMARY KEY (id);


--
-- Name: ExternalCalendarConnection ExternalCalendarConnection_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ExternalCalendarConnection"
    ADD CONSTRAINT "ExternalCalendarConnection_pkey" PRIMARY KEY (id);


--
-- Name: ExternalCalendarEvent ExternalCalendarEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ExternalCalendarEvent"
    ADD CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY (id);


--
-- Name: FileObject FileObject_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."FileObject"
    ADD CONSTRAINT "FileObject_pkey" PRIMARY KEY (id);


--
-- Name: FileTrash FileTrash_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."FileTrash"
    ADD CONSTRAINT "FileTrash_pkey" PRIMARY KEY (id);


--
-- Name: Folder Folder_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Folder"
    ADD CONSTRAINT "Folder_pkey" PRIMARY KEY (id);


--
-- Name: FormRequest FormRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."FormRequest"
    ADD CONSTRAINT "FormRequest_pkey" PRIMARY KEY (id);


--
-- Name: GuestInvite GuestInvite_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."GuestInvite"
    ADD CONSTRAINT "GuestInvite_pkey" PRIMARY KEY (id);


--
-- Name: IdentityCodeCatalog IdentityCodeCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."IdentityCodeCatalog"
    ADD CONSTRAINT "IdentityCodeCatalog_pkey" PRIMARY KEY (id);


--
-- Name: ImportError ImportError_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ImportError"
    ADD CONSTRAINT "ImportError_pkey" PRIMARY KEY (id);


--
-- Name: ImportJob ImportJob_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ImportJob"
    ADD CONSTRAINT "ImportJob_pkey" PRIMARY KEY (id);


--
-- Name: InternalInvite InternalInvite_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."InternalInvite"
    ADD CONSTRAINT "InternalInvite_pkey" PRIMARY KEY (id);


--
-- Name: MaintenanceMode MaintenanceMode_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MaintenanceMode"
    ADD CONSTRAINT "MaintenanceMode_pkey" PRIMARY KEY (id);


--
-- Name: MeetingAgendaItem MeetingAgendaItem_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingAgendaItem"
    ADD CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY (id);


--
-- Name: MeetingAgreement MeetingAgreement_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingAgreement"
    ADD CONSTRAINT "MeetingAgreement_pkey" PRIMARY KEY (id);


--
-- Name: MeetingCodeCatalog MeetingCodeCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingCodeCatalog"
    ADD CONSTRAINT "MeetingCodeCatalog_pkey" PRIMARY KEY (id);


--
-- Name: MeetingNote MeetingNote_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingNote"
    ADD CONSTRAINT "MeetingNote_pkey" PRIMARY KEY (id);


--
-- Name: MeetingParticipant MeetingParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingParticipant"
    ADD CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY (id);


--
-- Name: Meeting Meeting_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Meeting"
    ADD CONSTRAINT "Meeting_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: NotificationPreference NotificationPreference_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: ObjectiveCodeCatalog ObjectiveCodeCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ObjectiveCodeCatalog"
    ADD CONSTRAINT "ObjectiveCodeCatalog_pkey" PRIMARY KEY (id);


--
-- Name: ObjectiveTask ObjectiveTask_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ObjectiveTask"
    ADD CONSTRAINT "ObjectiveTask_pkey" PRIMARY KEY (id);


--
-- Name: Objective Objective_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Objective"
    ADD CONSTRAINT "Objective_pkey" PRIMARY KEY (id);


--
-- Name: OffboardingRecord OffboardingRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OffboardingRecord"
    ADD CONSTRAINT "OffboardingRecord_pkey" PRIMARY KEY (id);


--
-- Name: OnboardingChecklistItem OnboardingChecklistItem_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OnboardingChecklistItem"
    ADD CONSTRAINT "OnboardingChecklistItem_pkey" PRIMARY KEY (id);


--
-- Name: OnboardingChecklist OnboardingChecklist_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OnboardingChecklist"
    ADD CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY (id);


--
-- Name: OnboardingRunStep OnboardingRunStep_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OnboardingRunStep"
    ADD CONSTRAINT "OnboardingRunStep_pkey" PRIMARY KEY (id);


--
-- Name: OnboardingRun OnboardingRun_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OnboardingRun"
    ADD CONSTRAINT "OnboardingRun_pkey" PRIMARY KEY (id);


--
-- Name: PersonProfile PersonProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."PersonProfile"
    ADD CONSTRAINT "PersonProfile_pkey" PRIMARY KEY (id);


--
-- Name: ProjectCodeCatalog ProjectCodeCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ProjectCodeCatalog"
    ADD CONSTRAINT "ProjectCodeCatalog_pkey" PRIMARY KEY (id);


--
-- Name: ProjectMember ProjectMember_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_pkey" PRIMARY KEY (id);


--
-- Name: ProjectStage ProjectStage_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ProjectStage"
    ADD CONSTRAINT "ProjectStage_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: StorageQuota StorageQuota_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."StorageQuota"
    ADD CONSTRAINT "StorageQuota_pkey" PRIMARY KEY (id);


--
-- Name: TaskCodeCatalog TaskCodeCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskCodeCatalog"
    ADD CONSTRAINT "TaskCodeCatalog_pkey" PRIMARY KEY (id);


--
-- Name: TaskDependency TaskDependency_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskDependency"
    ADD CONSTRAINT "TaskDependency_pkey" PRIMARY KEY (id);


--
-- Name: TaskReassignment TaskReassignment_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskReassignment"
    ADD CONSTRAINT "TaskReassignment_pkey" PRIMARY KEY (id);


--
-- Name: TaskScheduleHistory TaskScheduleHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskScheduleHistory"
    ADD CONSTRAINT "TaskScheduleHistory_pkey" PRIMARY KEY (id);


--
-- Name: TaskStatusHistory TaskStatusHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskStatusHistory"
    ADD CONSTRAINT "TaskStatusHistory_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TeamCodeCatalog TeamCodeCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TeamCodeCatalog"
    ADD CONSTRAINT "TeamCodeCatalog_pkey" PRIMARY KEY (id);


--
-- Name: TeamMember TeamMember_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: TimeEntry TimeEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WebhookDelivery WebhookDelivery_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."WebhookDelivery"
    ADD CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY (id);


--
-- Name: WebhookEndpoint WebhookEndpoint_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."WebhookEndpoint"
    ADD CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY (id);


--
-- Name: WorkSchedule WorkSchedule_pkey; Type: CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."WorkSchedule"
    ADD CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY (id);


--
-- Name: AnnouncementTeam_announcementId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AnnouncementTeam_announcementId_idx" ON public."AnnouncementTeam" USING btree ("announcementId");


--
-- Name: AnnouncementTeam_announcementId_teamId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "AnnouncementTeam_announcementId_teamId_key" ON public."AnnouncementTeam" USING btree ("announcementId", "teamId");


--
-- Name: AnnouncementTeam_teamId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AnnouncementTeam_teamId_idx" ON public."AnnouncementTeam" USING btree ("teamId");


--
-- Name: AnnouncementUser_announcementId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AnnouncementUser_announcementId_idx" ON public."AnnouncementUser" USING btree ("announcementId");


--
-- Name: AnnouncementUser_announcementId_userId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "AnnouncementUser_announcementId_userId_key" ON public."AnnouncementUser" USING btree ("announcementId", "userId");


--
-- Name: AnnouncementUser_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AnnouncementUser_userId_idx" ON public."AnnouncementUser" USING btree ("userId");


--
-- Name: Announcement_createdById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Announcement_createdById_idx" ON public."Announcement" USING btree ("createdById");


--
-- Name: Announcement_expiresAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Announcement_expiresAt_idx" ON public."Announcement" USING btree ("expiresAt");


--
-- Name: AuditCodeCatalog_field_code_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "AuditCodeCatalog_field_code_key" ON public."AuditCodeCatalog" USING btree (field, code);


--
-- Name: AuditCodeCatalog_field_isActive_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AuditCodeCatalog_field_isActive_idx" ON public."AuditCodeCatalog" USING btree (field, "isActive");


--
-- Name: AuditLog_action_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AuditLog_action_idx" ON public."AuditLog" USING btree (action);


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- Name: AuditLog_reasonCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AuditLog_reasonCode_idx" ON public."AuditLog" USING btree ("reasonCode");


--
-- Name: AuditLog_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");


--
-- Name: AutomationRule_createdById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AutomationRule_createdById_idx" ON public."AutomationRule" USING btree ("createdById");


--
-- Name: AutomationRule_enabled_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AutomationRule_enabled_idx" ON public."AutomationRule" USING btree (enabled);


--
-- Name: AutomationRule_projectId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AutomationRule_projectId_idx" ON public."AutomationRule" USING btree ("projectId");


--
-- Name: AvailabilityBlock_startAt_endAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AvailabilityBlock_startAt_endAt_idx" ON public."AvailabilityBlock" USING btree ("startAt", "endAt");


--
-- Name: AvailabilityBlock_type_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AvailabilityBlock_type_idx" ON public."AvailabilityBlock" USING btree (type);


--
-- Name: AvailabilityBlock_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "AvailabilityBlock_userId_idx" ON public."AvailabilityBlock" USING btree ("userId");


--
-- Name: ChannelMember_channelId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ChannelMember_channelId_idx" ON public."ChannelMember" USING btree ("channelId");


--
-- Name: ChannelMember_channelId_userId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "ChannelMember_channelId_userId_key" ON public."ChannelMember" USING btree ("channelId", "userId");


--
-- Name: ChannelMember_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ChannelMember_userId_idx" ON public."ChannelMember" USING btree ("userId");


--
-- Name: Channel_projectId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Channel_projectId_idx" ON public."Channel" USING btree ("projectId");


--
-- Name: Channel_scope_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Channel_scope_idx" ON public."Channel" USING btree (scope);


--
-- Name: Channel_teamId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Channel_teamId_idx" ON public."Channel" USING btree ("teamId");


--
-- Name: DecisionCodeCatalog_field_code_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "DecisionCodeCatalog_field_code_key" ON public."DecisionCodeCatalog" USING btree (field, code);


--
-- Name: DecisionCodeCatalog_field_isActive_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "DecisionCodeCatalog_field_isActive_idx" ON public."DecisionCodeCatalog" USING btree (field, "isActive");


--
-- Name: DecisionNote_authorId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "DecisionNote_authorId_idx" ON public."DecisionNote" USING btree ("authorId");


--
-- Name: DecisionNote_descriptionCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "DecisionNote_descriptionCode_idx" ON public."DecisionNote" USING btree ("descriptionCode");


--
-- Name: DecisionNote_linkedEntityType_linkedEntityId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "DecisionNote_linkedEntityType_linkedEntityId_idx" ON public."DecisionNote" USING btree ("linkedEntityType", "linkedEntityId");


--
-- Name: ExternalCalendarConnection_provider_externalAccountId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "ExternalCalendarConnection_provider_externalAccountId_key" ON public."ExternalCalendarConnection" USING btree (provider, "externalAccountId");


--
-- Name: ExternalCalendarConnection_provider_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ExternalCalendarConnection_provider_idx" ON public."ExternalCalendarConnection" USING btree (provider);


--
-- Name: ExternalCalendarConnection_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ExternalCalendarConnection_userId_idx" ON public."ExternalCalendarConnection" USING btree ("userId");


--
-- Name: ExternalCalendarEvent_connectionId_externalId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "ExternalCalendarEvent_connectionId_externalId_key" ON public."ExternalCalendarEvent" USING btree ("connectionId", "externalId");


--
-- Name: ExternalCalendarEvent_connectionId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ExternalCalendarEvent_connectionId_idx" ON public."ExternalCalendarEvent" USING btree ("connectionId");


--
-- Name: ExternalCalendarEvent_projectId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ExternalCalendarEvent_projectId_idx" ON public."ExternalCalendarEvent" USING btree ("projectId");


--
-- Name: ExternalCalendarEvent_startsAt_endsAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ExternalCalendarEvent_startsAt_endsAt_idx" ON public."ExternalCalendarEvent" USING btree ("startsAt", "endsAt");


--
-- Name: ExternalCalendarEvent_teamId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ExternalCalendarEvent_teamId_idx" ON public."ExternalCalendarEvent" USING btree ("teamId");


--
-- Name: FileObject_deletedAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "FileObject_deletedAt_idx" ON public."FileObject" USING btree ("deletedAt");


--
-- Name: FileObject_folderId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "FileObject_folderId_idx" ON public."FileObject" USING btree ("folderId");


--
-- Name: FileObject_ownerId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "FileObject_ownerId_idx" ON public."FileObject" USING btree ("ownerId");


--
-- Name: FileTrash_fileId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "FileTrash_fileId_key" ON public."FileTrash" USING btree ("fileId");


--
-- Name: FileTrash_scheduledPurgeAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "FileTrash_scheduledPurgeAt_idx" ON public."FileTrash" USING btree ("scheduledPurgeAt");


--
-- Name: Folder_createdById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Folder_createdById_idx" ON public."Folder" USING btree ("createdById");


--
-- Name: Folder_parentId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Folder_parentId_idx" ON public."Folder" USING btree ("parentId");


--
-- Name: Folder_projectId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Folder_projectId_idx" ON public."Folder" USING btree ("projectId");


--
-- Name: Folder_teamId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Folder_teamId_idx" ON public."Folder" USING btree ("teamId");


--
-- Name: FormRequest_approverId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "FormRequest_approverId_idx" ON public."FormRequest" USING btree ("approverId");


--
-- Name: FormRequest_requesterId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "FormRequest_requesterId_idx" ON public."FormRequest" USING btree ("requesterId");


--
-- Name: FormRequest_status_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "FormRequest_status_idx" ON public."FormRequest" USING btree (status);


--
-- Name: GuestInvite_createdById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "GuestInvite_createdById_idx" ON public."GuestInvite" USING btree ("createdById");


--
-- Name: GuestInvite_email_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "GuestInvite_email_idx" ON public."GuestInvite" USING btree (email);


--
-- Name: GuestInvite_expiresAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "GuestInvite_expiresAt_idx" ON public."GuestInvite" USING btree ("expiresAt");


--
-- Name: GuestInvite_resourceType_resourceId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "GuestInvite_resourceType_resourceId_idx" ON public."GuestInvite" USING btree ("resourceType", "resourceId");


--
-- Name: IdentityCodeCatalog_field_code_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "IdentityCodeCatalog_field_code_key" ON public."IdentityCodeCatalog" USING btree (field, code);


--
-- Name: IdentityCodeCatalog_field_isActive_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "IdentityCodeCatalog_field_isActive_idx" ON public."IdentityCodeCatalog" USING btree (field, "isActive");


--
-- Name: ImportError_jobId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ImportError_jobId_idx" ON public."ImportError" USING btree ("jobId");


--
-- Name: ImportJob_createdById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ImportJob_createdById_idx" ON public."ImportJob" USING btree ("createdById");


--
-- Name: ImportJob_source_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ImportJob_source_idx" ON public."ImportJob" USING btree (source);


--
-- Name: InternalInvite_createdById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "InternalInvite_createdById_idx" ON public."InternalInvite" USING btree ("createdById");


--
-- Name: InternalInvite_email_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "InternalInvite_email_idx" ON public."InternalInvite" USING btree (email);


--
-- Name: InternalInvite_expiresAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "InternalInvite_expiresAt_idx" ON public."InternalInvite" USING btree ("expiresAt");


--
-- Name: InternalInvite_teamId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "InternalInvite_teamId_idx" ON public."InternalInvite" USING btree ("teamId");


--
-- Name: InternalInvite_tokenHash_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "InternalInvite_tokenHash_key" ON public."InternalInvite" USING btree ("tokenHash");


--
-- Name: MeetingAgendaItem_meetingId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingAgendaItem_meetingId_idx" ON public."MeetingAgendaItem" USING btree ("meetingId");


--
-- Name: MeetingAgendaItem_meetingId_order_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "MeetingAgendaItem_meetingId_order_key" ON public."MeetingAgendaItem" USING btree ("meetingId", "order");


--
-- Name: MeetingAgreement_authorId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingAgreement_authorId_idx" ON public."MeetingAgreement" USING btree ("authorId");


--
-- Name: MeetingAgreement_descriptionCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingAgreement_descriptionCode_idx" ON public."MeetingAgreement" USING btree ("descriptionCode");


--
-- Name: MeetingAgreement_meetingId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingAgreement_meetingId_idx" ON public."MeetingAgreement" USING btree ("meetingId");


--
-- Name: MeetingAgreement_status_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingAgreement_status_idx" ON public."MeetingAgreement" USING btree (status);


--
-- Name: MeetingAgreement_taskId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingAgreement_taskId_idx" ON public."MeetingAgreement" USING btree ("taskId");


--
-- Name: MeetingCodeCatalog_field_code_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "MeetingCodeCatalog_field_code_key" ON public."MeetingCodeCatalog" USING btree (field, code);


--
-- Name: MeetingCodeCatalog_field_isActive_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingCodeCatalog_field_isActive_idx" ON public."MeetingCodeCatalog" USING btree (field, "isActive");


--
-- Name: MeetingNote_authorId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingNote_authorId_idx" ON public."MeetingNote" USING btree ("authorId");


--
-- Name: MeetingNote_meetingId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingNote_meetingId_idx" ON public."MeetingNote" USING btree ("meetingId");


--
-- Name: MeetingParticipant_meetingId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingParticipant_meetingId_idx" ON public."MeetingParticipant" USING btree ("meetingId");


--
-- Name: MeetingParticipant_meetingId_userId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "MeetingParticipant_meetingId_userId_key" ON public."MeetingParticipant" USING btree ("meetingId", "userId");


--
-- Name: MeetingParticipant_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "MeetingParticipant_userId_idx" ON public."MeetingParticipant" USING btree ("userId");


--
-- Name: Meeting_createdById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Meeting_createdById_idx" ON public."Meeting" USING btree ("createdById");


--
-- Name: Meeting_descriptionCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Meeting_descriptionCode_idx" ON public."Meeting" USING btree ("descriptionCode");


--
-- Name: Meeting_projectId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Meeting_projectId_idx" ON public."Meeting" USING btree ("projectId");


--
-- Name: Meeting_startsAt_endsAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Meeting_startsAt_endsAt_idx" ON public."Meeting" USING btree ("startsAt", "endsAt");


--
-- Name: Meeting_status_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Meeting_status_idx" ON public."Meeting" USING btree (status);


--
-- Name: Meeting_teamId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Meeting_teamId_idx" ON public."Meeting" USING btree ("teamId");


--
-- Name: Message_authorId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Message_authorId_idx" ON public."Message" USING btree ("authorId");


--
-- Name: Message_channelId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Message_channelId_idx" ON public."Message" USING btree ("channelId");


--
-- Name: Message_createdAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Message_createdAt_idx" ON public."Message" USING btree ("createdAt");


--
-- Name: NotificationPreference_userId_event_channel_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "NotificationPreference_userId_event_channel_key" ON public."NotificationPreference" USING btree ("userId", event, channel);


--
-- Name: NotificationPreference_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "NotificationPreference_userId_idx" ON public."NotificationPreference" USING btree ("userId");


--
-- Name: Notification_createdAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Notification_createdAt_idx" ON public."Notification" USING btree ("createdAt");


--
-- Name: Notification_deliveredAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Notification_deliveredAt_idx" ON public."Notification" USING btree ("deliveredAt");


--
-- Name: Notification_event_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Notification_event_idx" ON public."Notification" USING btree (event);


--
-- Name: Notification_readAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Notification_readAt_idx" ON public."Notification" USING btree ("readAt");


--
-- Name: Notification_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Notification_userId_idx" ON public."Notification" USING btree ("userId");


--
-- Name: ObjectiveCodeCatalog_field_code_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "ObjectiveCodeCatalog_field_code_key" ON public."ObjectiveCodeCatalog" USING btree (field, code);


--
-- Name: ObjectiveCodeCatalog_field_isActive_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ObjectiveCodeCatalog_field_isActive_idx" ON public."ObjectiveCodeCatalog" USING btree (field, "isActive");


--
-- Name: ObjectiveTask_objectiveId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ObjectiveTask_objectiveId_idx" ON public."ObjectiveTask" USING btree ("objectiveId");


--
-- Name: ObjectiveTask_objectiveId_taskId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "ObjectiveTask_objectiveId_taskId_key" ON public."ObjectiveTask" USING btree ("objectiveId", "taskId");


--
-- Name: ObjectiveTask_taskId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ObjectiveTask_taskId_idx" ON public."ObjectiveTask" USING btree ("taskId");


--
-- Name: Objective_descriptionCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Objective_descriptionCode_idx" ON public."Objective" USING btree ("descriptionCode");


--
-- Name: Objective_ownerId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Objective_ownerId_idx" ON public."Objective" USING btree ("ownerId");


--
-- Name: Objective_projectId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Objective_projectId_idx" ON public."Objective" USING btree ("projectId");


--
-- Name: Objective_teamId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Objective_teamId_idx" ON public."Objective" USING btree ("teamId");


--
-- Name: OffboardingRecord_reasonCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "OffboardingRecord_reasonCode_idx" ON public."OffboardingRecord" USING btree ("reasonCode");


--
-- Name: OffboardingRecord_transferToUserId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "OffboardingRecord_transferToUserId_idx" ON public."OffboardingRecord" USING btree ("transferToUserId");


--
-- Name: OffboardingRecord_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "OffboardingRecord_userId_idx" ON public."OffboardingRecord" USING btree ("userId");


--
-- Name: OnboardingChecklistItem_checklistId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "OnboardingChecklistItem_checklistId_idx" ON public."OnboardingChecklistItem" USING btree ("checklistId");


--
-- Name: OnboardingChecklistItem_checklistId_stepKey_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "OnboardingChecklistItem_checklistId_stepKey_key" ON public."OnboardingChecklistItem" USING btree ("checklistId", "stepKey");


--
-- Name: OnboardingChecklistItem_order_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "OnboardingChecklistItem_order_idx" ON public."OnboardingChecklistItem" USING btree ("order");


--
-- Name: OnboardingRunStep_runId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "OnboardingRunStep_runId_idx" ON public."OnboardingRunStep" USING btree ("runId");


--
-- Name: OnboardingRunStep_runId_stepKey_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "OnboardingRunStep_runId_stepKey_key" ON public."OnboardingRunStep" USING btree ("runId", "stepKey");


--
-- Name: OnboardingRun_checklistId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "OnboardingRun_checklistId_idx" ON public."OnboardingRun" USING btree ("checklistId");


--
-- Name: OnboardingRun_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "OnboardingRun_userId_idx" ON public."OnboardingRun" USING btree ("userId");


--
-- Name: PersonProfile_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "PersonProfile_userId_idx" ON public."PersonProfile" USING btree ("userId");


--
-- Name: PersonProfile_userId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "PersonProfile_userId_key" ON public."PersonProfile" USING btree ("userId");


--
-- Name: ProjectCodeCatalog_field_code_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "ProjectCodeCatalog_field_code_key" ON public."ProjectCodeCatalog" USING btree (field, code);


--
-- Name: ProjectCodeCatalog_field_isActive_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ProjectCodeCatalog_field_isActive_idx" ON public."ProjectCodeCatalog" USING btree (field, "isActive");


--
-- Name: ProjectMember_projectId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ProjectMember_projectId_idx" ON public."ProjectMember" USING btree ("projectId");


--
-- Name: ProjectMember_projectId_userId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON public."ProjectMember" USING btree ("projectId", "userId");


--
-- Name: ProjectMember_role_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ProjectMember_role_idx" ON public."ProjectMember" USING btree (role);


--
-- Name: ProjectMember_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ProjectMember_userId_idx" ON public."ProjectMember" USING btree ("userId");


--
-- Name: ProjectStage_projectId_code_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "ProjectStage_projectId_code_key" ON public."ProjectStage" USING btree ("projectId", code);


--
-- Name: ProjectStage_projectId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ProjectStage_projectId_idx" ON public."ProjectStage" USING btree ("projectId");


--
-- Name: ProjectStage_projectId_name_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "ProjectStage_projectId_name_key" ON public."ProjectStage" USING btree ("projectId", name);


--
-- Name: ProjectStage_projectId_order_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "ProjectStage_projectId_order_idx" ON public."ProjectStage" USING btree ("projectId", "order");


--
-- Name: Project_descriptionCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Project_descriptionCode_idx" ON public."Project" USING btree ("descriptionCode");


--
-- Name: Project_ownerId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Project_ownerId_idx" ON public."Project" USING btree ("ownerId");


--
-- Name: Project_template_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Project_template_idx" ON public."Project" USING btree (template);


--
-- Name: RefreshToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "RefreshToken_expiresAt_idx" ON public."RefreshToken" USING btree ("expiresAt");


--
-- Name: RefreshToken_revokedAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "RefreshToken_revokedAt_idx" ON public."RefreshToken" USING btree ("revokedAt");


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "RefreshToken_userId_idx" ON public."RefreshToken" USING btree ("userId");


--
-- Name: StorageQuota_scopeType_scopeId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "StorageQuota_scopeType_scopeId_idx" ON public."StorageQuota" USING btree ("scopeType", "scopeId");


--
-- Name: StorageQuota_scopeType_scopeId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "StorageQuota_scopeType_scopeId_key" ON public."StorageQuota" USING btree ("scopeType", "scopeId");


--
-- Name: TaskCodeCatalog_field_code_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "TaskCodeCatalog_field_code_key" ON public."TaskCodeCatalog" USING btree (field, code);


--
-- Name: TaskCodeCatalog_field_isActive_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskCodeCatalog_field_isActive_idx" ON public."TaskCodeCatalog" USING btree (field, "isActive");


--
-- Name: TaskDependency_dependsOnTaskId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskDependency_dependsOnTaskId_idx" ON public."TaskDependency" USING btree ("dependsOnTaskId");


--
-- Name: TaskDependency_taskId_dependsOnTaskId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key" ON public."TaskDependency" USING btree ("taskId", "dependsOnTaskId");


--
-- Name: TaskDependency_taskId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskDependency_taskId_idx" ON public."TaskDependency" USING btree ("taskId");


--
-- Name: TaskReassignment_newAssigneeId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskReassignment_newAssigneeId_idx" ON public."TaskReassignment" USING btree ("newAssigneeId");


--
-- Name: TaskReassignment_reasonCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskReassignment_reasonCode_idx" ON public."TaskReassignment" USING btree ("reasonCode");


--
-- Name: TaskReassignment_reassignedById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskReassignment_reassignedById_idx" ON public."TaskReassignment" USING btree ("reassignedById");


--
-- Name: TaskReassignment_taskId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskReassignment_taskId_idx" ON public."TaskReassignment" USING btree ("taskId");


--
-- Name: TaskScheduleHistory_changedAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskScheduleHistory_changedAt_idx" ON public."TaskScheduleHistory" USING btree ("changedAt");


--
-- Name: TaskScheduleHistory_changedById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskScheduleHistory_changedById_idx" ON public."TaskScheduleHistory" USING btree ("changedById");


--
-- Name: TaskScheduleHistory_reasonCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskScheduleHistory_reasonCode_idx" ON public."TaskScheduleHistory" USING btree ("reasonCode");


--
-- Name: TaskScheduleHistory_taskId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskScheduleHistory_taskId_idx" ON public."TaskScheduleHistory" USING btree ("taskId");


--
-- Name: TaskStatusHistory_changedAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskStatusHistory_changedAt_idx" ON public."TaskStatusHistory" USING btree ("changedAt");


--
-- Name: TaskStatusHistory_changedById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskStatusHistory_changedById_idx" ON public."TaskStatusHistory" USING btree ("changedById");


--
-- Name: TaskStatusHistory_reasonCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskStatusHistory_reasonCode_idx" ON public."TaskStatusHistory" USING btree ("reasonCode");


--
-- Name: TaskStatusHistory_taskId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TaskStatusHistory_taskId_idx" ON public."TaskStatusHistory" USING btree ("taskId");


--
-- Name: Task_assigneeId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_assigneeId_idx" ON public."Task" USING btree ("assigneeId");


--
-- Name: Task_blockedReasonCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_blockedReasonCode_idx" ON public."Task" USING btree ("blockedReasonCode");


--
-- Name: Task_blockingTaskId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_blockingTaskId_idx" ON public."Task" USING btree ("blockingTaskId");


--
-- Name: Task_createdById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_createdById_idx" ON public."Task" USING btree ("createdById");


--
-- Name: Task_descriptionCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_descriptionCode_idx" ON public."Task" USING btree ("descriptionCode");


--
-- Name: Task_dueDate_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_dueDate_idx" ON public."Task" USING btree ("dueDate");


--
-- Name: Task_projectId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_projectId_idx" ON public."Task" USING btree ("projectId");


--
-- Name: Task_stageId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_stageId_idx" ON public."Task" USING btree ("stageId");


--
-- Name: Task_startDate_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_startDate_idx" ON public."Task" USING btree ("startDate");


--
-- Name: Task_status_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Task_status_idx" ON public."Task" USING btree (status);


--
-- Name: TeamCodeCatalog_field_code_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "TeamCodeCatalog_field_code_key" ON public."TeamCodeCatalog" USING btree (field, code);


--
-- Name: TeamCodeCatalog_field_isActive_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TeamCodeCatalog_field_isActive_idx" ON public."TeamCodeCatalog" USING btree (field, "isActive");


--
-- Name: TeamMember_teamId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TeamMember_teamId_idx" ON public."TeamMember" USING btree ("teamId");


--
-- Name: TeamMember_teamId_userId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON public."TeamMember" USING btree ("teamId", "userId");


--
-- Name: TeamMember_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TeamMember_userId_idx" ON public."TeamMember" USING btree ("userId");


--
-- Name: Team_descriptionCode_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Team_descriptionCode_idx" ON public."Team" USING btree ("descriptionCode");


--
-- Name: Team_name_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "Team_name_idx" ON public."Team" USING btree (name);


--
-- Name: Team_name_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "Team_name_key" ON public."Team" USING btree (name);


--
-- Name: TimeEntry_loggedAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TimeEntry_loggedAt_idx" ON public."TimeEntry" USING btree ("loggedAt");


--
-- Name: TimeEntry_taskId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TimeEntry_taskId_idx" ON public."TimeEntry" USING btree ("taskId");


--
-- Name: TimeEntry_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "TimeEntry_userId_idx" ON public."TimeEntry" USING btree ("userId");


--
-- Name: User_baseRole_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "User_baseRole_idx" ON public."User" USING btree ("baseRole");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_isActive_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "User_isActive_idx" ON public."User" USING btree ("isActive");


--
-- Name: WebhookDelivery_attemptedAt_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "WebhookDelivery_attemptedAt_idx" ON public."WebhookDelivery" USING btree ("attemptedAt");


--
-- Name: WebhookDelivery_endpointId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "WebhookDelivery_endpointId_idx" ON public."WebhookDelivery" USING btree ("endpointId");


--
-- Name: WebhookEndpoint_createdById_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "WebhookEndpoint_createdById_idx" ON public."WebhookEndpoint" USING btree ("createdById");


--
-- Name: WebhookEndpoint_event_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "WebhookEndpoint_event_idx" ON public."WebhookEndpoint" USING btree (event);


--
-- Name: WorkSchedule_userId_idx; Type: INDEX; Schema: public; Owner: corelia
--

CREATE INDEX "WorkSchedule_userId_idx" ON public."WorkSchedule" USING btree ("userId");


--
-- Name: WorkSchedule_userId_key; Type: INDEX; Schema: public; Owner: corelia
--

CREATE UNIQUE INDEX "WorkSchedule_userId_key" ON public."WorkSchedule" USING btree ("userId");


--
-- Name: AnnouncementTeam AnnouncementTeam_announcementId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AnnouncementTeam"
    ADD CONSTRAINT "AnnouncementTeam_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES public."Announcement"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnnouncementTeam AnnouncementTeam_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AnnouncementTeam"
    ADD CONSTRAINT "AnnouncementTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnnouncementUser AnnouncementUser_announcementId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AnnouncementUser"
    ADD CONSTRAINT "AnnouncementUser_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES public."Announcement"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnnouncementUser AnnouncementUser_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AnnouncementUser"
    ADD CONSTRAINT "AnnouncementUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Announcement Announcement_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AutomationRule AutomationRule_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AutomationRule"
    ADD CONSTRAINT "AutomationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AutomationRule AutomationRule_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AutomationRule"
    ADD CONSTRAINT "AutomationRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AvailabilityBlock AvailabilityBlock_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."AvailabilityBlock"
    ADD CONSTRAINT "AvailabilityBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChannelMember ChannelMember_channelId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ChannelMember"
    ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES public."Channel"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChannelMember ChannelMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ChannelMember"
    ADD CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Channel Channel_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Channel"
    ADD CONSTRAINT "Channel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Channel Channel_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Channel"
    ADD CONSTRAINT "Channel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DecisionNote DecisionNote_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."DecisionNote"
    ADD CONSTRAINT "DecisionNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExternalCalendarConnection ExternalCalendarConnection_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ExternalCalendarConnection"
    ADD CONSTRAINT "ExternalCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExternalCalendarEvent ExternalCalendarEvent_connectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ExternalCalendarEvent"
    ADD CONSTRAINT "ExternalCalendarEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES public."ExternalCalendarConnection"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExternalCalendarEvent ExternalCalendarEvent_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ExternalCalendarEvent"
    ADD CONSTRAINT "ExternalCalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ExternalCalendarEvent ExternalCalendarEvent_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ExternalCalendarEvent"
    ADD CONSTRAINT "ExternalCalendarEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FileObject FileObject_folderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."FileObject"
    ADD CONSTRAINT "FileObject_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES public."Folder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FileObject FileObject_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."FileObject"
    ADD CONSTRAINT "FileObject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FileTrash FileTrash_fileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."FileTrash"
    ADD CONSTRAINT "FileTrash_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES public."FileObject"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Folder Folder_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Folder"
    ADD CONSTRAINT "Folder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Folder Folder_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Folder"
    ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Folder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Folder Folder_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Folder"
    ADD CONSTRAINT "Folder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Folder Folder_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Folder"
    ADD CONSTRAINT "Folder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FormRequest FormRequest_approverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."FormRequest"
    ADD CONSTRAINT "FormRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FormRequest FormRequest_requesterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."FormRequest"
    ADD CONSTRAINT "FormRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GuestInvite GuestInvite_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."GuestInvite"
    ADD CONSTRAINT "GuestInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ImportError ImportError_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ImportError"
    ADD CONSTRAINT "ImportError_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."ImportJob"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ImportJob ImportJob_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ImportJob"
    ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InternalInvite InternalInvite_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."InternalInvite"
    ADD CONSTRAINT "InternalInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InternalInvite InternalInvite_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."InternalInvite"
    ADD CONSTRAINT "InternalInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MeetingAgendaItem MeetingAgendaItem_meetingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingAgendaItem"
    ADD CONSTRAINT "MeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES public."Meeting"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeetingAgreement MeetingAgreement_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingAgreement"
    ADD CONSTRAINT "MeetingAgreement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeetingAgreement MeetingAgreement_meetingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingAgreement"
    ADD CONSTRAINT "MeetingAgreement_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES public."Meeting"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeetingAgreement MeetingAgreement_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingAgreement"
    ADD CONSTRAINT "MeetingAgreement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MeetingNote MeetingNote_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingNote"
    ADD CONSTRAINT "MeetingNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeetingNote MeetingNote_meetingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingNote"
    ADD CONSTRAINT "MeetingNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES public."Meeting"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeetingParticipant MeetingParticipant_meetingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingParticipant"
    ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES public."Meeting"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeetingParticipant MeetingParticipant_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."MeetingParticipant"
    ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Meeting Meeting_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Meeting"
    ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Meeting Meeting_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Meeting"
    ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Meeting Meeting_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Meeting"
    ADD CONSTRAINT "Meeting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Message Message_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Message Message_channelId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES public."Channel"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NotificationPreference NotificationPreference_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ObjectiveTask ObjectiveTask_objectiveId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ObjectiveTask"
    ADD CONSTRAINT "ObjectiveTask_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES public."Objective"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ObjectiveTask ObjectiveTask_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ObjectiveTask"
    ADD CONSTRAINT "ObjectiveTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Objective Objective_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Objective"
    ADD CONSTRAINT "Objective_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Objective Objective_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Objective"
    ADD CONSTRAINT "Objective_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Objective Objective_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Objective"
    ADD CONSTRAINT "Objective_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OffboardingRecord OffboardingRecord_transferToUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OffboardingRecord"
    ADD CONSTRAINT "OffboardingRecord_transferToUserId_fkey" FOREIGN KEY ("transferToUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OffboardingRecord OffboardingRecord_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OffboardingRecord"
    ADD CONSTRAINT "OffboardingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OnboardingChecklistItem OnboardingChecklistItem_checklistId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OnboardingChecklistItem"
    ADD CONSTRAINT "OnboardingChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES public."OnboardingChecklist"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OnboardingRunStep OnboardingRunStep_runId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OnboardingRunStep"
    ADD CONSTRAINT "OnboardingRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES public."OnboardingRun"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OnboardingRun OnboardingRun_checklistId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OnboardingRun"
    ADD CONSTRAINT "OnboardingRun_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES public."OnboardingChecklist"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OnboardingRun OnboardingRun_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."OnboardingRun"
    ADD CONSTRAINT "OnboardingRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PersonProfile PersonProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."PersonProfile"
    ADD CONSTRAINT "PersonProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProjectMember ProjectMember_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProjectMember ProjectMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProjectStage ProjectStage_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."ProjectStage"
    ADD CONSTRAINT "ProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskDependency TaskDependency_dependsOnTaskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskDependency"
    ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskDependency TaskDependency_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskDependency"
    ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskReassignment TaskReassignment_reassignedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskReassignment"
    ADD CONSTRAINT "TaskReassignment_reassignedById_fkey" FOREIGN KEY ("reassignedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskReassignment TaskReassignment_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskReassignment"
    ADD CONSTRAINT "TaskReassignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskScheduleHistory TaskScheduleHistory_changedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskScheduleHistory"
    ADD CONSTRAINT "TaskScheduleHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskScheduleHistory TaskScheduleHistory_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskScheduleHistory"
    ADD CONSTRAINT "TaskScheduleHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskStatusHistory TaskStatusHistory_changedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskStatusHistory"
    ADD CONSTRAINT "TaskStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskStatusHistory TaskStatusHistory_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TaskStatusHistory"
    ADD CONSTRAINT "TaskStatusHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_blockingTaskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_blockingTaskId_fkey" FOREIGN KEY ("blockingTaskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Task Task_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_stageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES public."ProjectStage"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TeamMember TeamMember_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeamMember TeamMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TimeEntry TimeEntry_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TimeEntry TimeEntry_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WebhookDelivery WebhookDelivery_endpointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."WebhookDelivery"
    ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES public."WebhookEndpoint"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WebhookEndpoint WebhookEndpoint_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."WebhookEndpoint"
    ADD CONSTRAINT "WebhookEndpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkSchedule WorkSchedule_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: corelia
--

ALTER TABLE ONLY public."WorkSchedule"
    ADD CONSTRAINT "WorkSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict aB7Au6VWGhvfFrJNS0khdJQQNUXQqhAHFEUP8GmwocEPjD9HoCWdlG3mQDEUJyJ

