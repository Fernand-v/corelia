-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDIENTE', 'EN_REVISION', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "ProjectTemplate" AS ENUM ('SOFTWARE', 'CONTENIDO', 'OPERACIONES');

-- CreateEnum
CREATE TYPE "ProjectMembershipSource" AS ENUM ('MANUAL', 'SYNC');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('VACACIONES', 'PERMISO', 'AUSENCIA', 'NO_DISPONIBLE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('INMEDIATA', 'RESUMEN_DIARIO');

-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('TAREA_ASIGNADA', 'TAREA_REASIGNADA', 'TAREA_ESTADO_CAMBIADO', 'MENSAJE_NUEVO_CANAL', 'MENCION_MENSAJE', 'REUNION_PROGRAMADA', 'ACUERDO_ASIGNADO_TAREA', 'TAREA_PROXIMA_VENCER', 'TAREA_BLOQUEADA', 'SOLICITUD_RESUELTA');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('VACACIONES', 'PERMISO', 'ACCESO_RECURSO');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "ChannelScope" AS ENUM ('EQUIPO', 'PROYECTO');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'FILE', 'CALL_INVITE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TEXTO', 'DIAGRAMA', 'TABLA', 'WHITEBOARD', 'PRESENTACION');

-- CreateEnum
CREATE TYPE "DiagramEngine" AS ENUM ('EXCALIDRAW', 'REACT_FLOW');

-- CreateEnum
CREATE TYPE "DiagramKind" AS ENUM ('FLUJO', 'SECUENCIA', 'UML_CLASES', 'ENTIDAD_RELACION', 'ESTADO', 'ARQUITECTURA', 'BPMN');

-- CreateEnum
CREATE TYPE "DocumentVersionKind" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "FolderScope" AS ENUM ('EQUIPO', 'PROYECTO');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USUARIO', 'PROYECTO', 'TAREA', 'REUNION', 'ACUERDO_REUNION', 'MENSAJE', 'ARCHIVO', 'SOLICITUD', 'ANUNCIO', 'OBJETIVO', 'DECISION', 'AUTOMATIZACION', 'GASTO');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LOGIN', 'LOGOUT', 'CREAR', 'ACTUALIZAR', 'ELIMINAR', 'PROGRAMAR_REUNION', 'REGISTRAR_ACUERDO', 'CAMBIO_ROL', 'CAMBIO_ESTADO_TAREA', 'REASIGNAR_TAREA', 'APROBAR_SOLICITUD', 'CAMBIO_PERMISO');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('PROGRAMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MeetingAgreementStatus" AS ENUM ('PENDIENTE_ACCION', 'VINCULADO_TAREA', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "ExternalCalendarProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "AutomationEvent" AS ENUM ('TAREA_COMPLETADA', 'TAREA_SIN_MOVIMIENTO', 'TAREA_REASIGNADA', 'TAREA_VENCIDA', 'SOLICITUD_RESUELTA');

-- CreateEnum
CREATE TYPE "AutomationAction" AS ENUM ('ENVIAR_NOTIFICACION', 'CREAR_AUDITORIA', 'CAMBIAR_ESTADO_TAREA');

-- CreateEnum
CREATE TYPE "ObjectiveScope" AS ENUM ('EQUIPO', 'PROYECTO');

-- CreateEnum
CREATE TYPE "WebhookEvent" AS ENUM ('TAREA_COMPLETADA', 'SOLICITUD_APROBADA', 'SOLICITUD_RECHAZADA', 'TAREA_REASIGNADA', 'TAREA_VENCIDA');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('CSV', 'TRELLO_JSON', 'NOTION_CSV');

-- CreateEnum
CREATE TYPE "TaskCodeField" AS ENUM ('TASK_DESCRIPTION', 'TASK_BLOCKED_REASON', 'TASK_STATUS_REASON', 'TASK_REASSIGN_REASON', 'TASK_SCHEDULE_REASON');

-- CreateEnum
CREATE TYPE "ProjectCodeField" AS ENUM ('PROJECT_DESCRIPTION');

-- CreateEnum
CREATE TYPE "TeamCodeField" AS ENUM ('TEAM_DESCRIPTION');

-- CreateEnum
CREATE TYPE "MeetingCodeField" AS ENUM ('MEETING_DESCRIPTION', 'MEETING_AGREEMENT_DESCRIPTION');

-- CreateEnum
CREATE TYPE "ObjectiveCodeField" AS ENUM ('OBJECTIVE_DESCRIPTION');

-- CreateEnum
CREATE TYPE "DecisionCodeField" AS ENUM ('DECISION_DESCRIPTION');

-- CreateEnum
CREATE TYPE "IdentityCodeField" AS ENUM ('OFFBOARDING_REASON');

-- CreateEnum
CREATE TYPE "AuditCodeField" AS ENUM ('AUDIT_REASON');

-- CreateEnum
CREATE TYPE "GuestResourceType" AS ENUM ('PROYECTO', 'ARCHIVO', 'DOCUMENTO');

-- CreateEnum
CREATE TYPE "StorageQuotaScope" AS ENUM ('USUARIO', 'EQUIPO');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('GLOBAL', 'PROJECT');

-- CreateTable
CREATE TABLE "PermissionCategory" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "scope" "RoleScope" NOT NULL DEFAULT 'PROJECT',
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "baseRoleId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "descriptionCatalogId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "descriptionCatalogId" UUID,
    "template" "ProjectTemplate" NOT NULL,
    "ownerId" UUID NOT NULL,
    "startDate" TIMESTAMP(3),
    "estimatedEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "membershipSource" "ProjectMembershipSource" NOT NULL DEFAULT 'MANUAL',
    "syncTeamsCount" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTeamLink" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTeamLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "stageId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "descriptionCatalogId" UUID,
    "assigneeId" UUID,
    "createdById" UUID NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDIENTE',
    "pendingActivatedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "blockingTaskId" UUID,
    "blockedReason" TEXT,
    "blockedReasonCatalogId" UUID,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStage" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4F7CFF',
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "dependsOnTaskId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStatusHistory" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonCatalogId" UUID,
    "changedById" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskReassignment" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "previousAssigneeId" UUID,
    "newAssigneeId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonCatalogId" UUID,
    "reassignedById" UUID NOT NULL,
    "reassignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskReassignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskScheduleHistory" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "previousStartDate" TIMESTAMP(3),
    "previousDueDate" TIMESTAMP(3),
    "newStartDate" TIMESTAMP(3),
    "newDueDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "reasonCatalogId" UUID,
    "changedById" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskScheduleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklist" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklistItem" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "stepKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,

    CONSTRAINT "OnboardingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingRun" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OnboardingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingRunStep" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "stepKey" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OnboardingRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffboardingRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "transferToUserId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonCatalogId" UUID,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "OffboardingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestInvite" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "projectId" UUID,
    "fileId" UUID,
    "documentId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalInvite" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "baseRoleId" UUID NOT NULL,
    "teamId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resentAt" TIMESTAMP(3),

    CONSTRAINT "InternalInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "internalContactEmail" TEXT NOT NULL,
    "internalPhone" TEXT,
    "skills" TEXT[],
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityBlock" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AvailabilityType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "timezone" TEXT NOT NULL,
    "weekDays" INTEGER[],
    "startHour" TEXT NOT NULL,
    "endHour" TEXT NOT NULL,
    "maxActiveTasks" INTEGER NOT NULL DEFAULT 5,
    "periodHoursCapacity" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "ChannelScope" NOT NULL,
    "teamId" UUID,
    "projectId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMember" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "mentions" TEXT[],
    "meetingId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "minioPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "descriptionCatalogId" UUID,
    "projectId" UUID,
    "teamId" UUID,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "mediaRoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingParticipant" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "cameraOn" BOOLEAN NOT NULL DEFAULT true,
    "screenSharing" BOOLEAN NOT NULL DEFAULT false,
    "speaking" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAgendaItem" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingNote" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "contentText" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAgreement" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "descriptionCatalogId" UUID,
    "status" "MeetingAgreementStatus" NOT NULL DEFAULT 'PENDIENTE_ACCION',
    "authorId" UUID NOT NULL,
    "taskId" UUID,
    "createdTask" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendarConnection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "ExternalCalendarProvider" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendarEvent" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "projectId" UUID,
    "teamId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "frequency" "NotificationFrequency" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "allCompany" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementTeam" (
    "id" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "teamId" UUID NOT NULL,

    CONSTRAINT "AnnouncementTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementUser" (
    "id" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "AnnouncementUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormRequest" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "approverId" UUID,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "FolderScope" NOT NULL,
    "teamId" UUID,
    "projectId" UUID,
    "parentId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocumentSpace" (
    "projectId" UUID NOT NULL,
    "rootFolderId" UUID NOT NULL,
    "textoFolderId" UUID NOT NULL,
    "diagramasFolderId" UUID NOT NULL,
    "tablasFolderId" UUID NOT NULL,
    "whiteboardFolderId" UUID NOT NULL,
    "presentacionesFolderId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocumentSpace_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "CollaborativeDocument" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "folderId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "yDocName" TEXT NOT NULL,
    "diagramEngine" "DiagramEngine",
    "diagramKind" "DiagramKind",
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "purgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborativeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborativeDocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "kind" "DocumentVersionKind" NOT NULL,
    "snapshotPath" TEXT NOT NULL,
    "snapshotSizeBytes" INTEGER NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborativeDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAsset" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "minioPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" UUID NOT NULL,
    "folderId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "minioPath" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileTrash" (
    "id" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "scheduledPurgeAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileTrash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageQuota" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "teamId" UUID,
    "bytesLimit" BIGINT NOT NULL,
    "alertThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionNote" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionCatalogId" UUID,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedEntityType" "EntityType" NOT NULL,
    "linkedEntityId" UUID NOT NULL,

    CONSTRAINT "DecisionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "event" "AutomationEvent" NOT NULL,
    "action" "AutomationAction" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configText" TEXT,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" UUID NOT NULL,
    "scope" "ObjectiveScope" NOT NULL,
    "teamId" UUID,
    "projectId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "descriptionCatalogId" UUID,
    "ownerId" UUID NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveTask" (
    "id" UUID NOT NULL,
    "objectiveId" UUID NOT NULL,
    "taskId" UUID NOT NULL,

    CONSTRAINT "ObjectiveTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "event" "WebhookEvent" NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "source" "ImportSource" NOT NULL,
    "filename" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "rotatedFromId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "action" "ActionType" NOT NULL,
    "userId" UUID,
    "previousDataText" TEXT,
    "newDataText" TEXT,
    "reason" TEXT,
    "reasonCatalogId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "TaskCodeField" NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "ProjectCodeField" NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "TeamCodeField" NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "MeetingCodeField" NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "ObjectiveCodeField" NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectiveCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "DecisionCodeField" NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "IdentityCodeField" NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "AuditCodeField" NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceMode" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontendSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "organizationName" TEXT NOT NULL,
    "taskStatusColorPending" TEXT NOT NULL,
    "taskStatusColorInReview" TEXT NOT NULL,
    "taskStatusColorCompleted" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontendSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDetail" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedBudget" DOUBLE PRECISION NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "projectDetailId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "receiptPath" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDIENTE',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionCategory_code_key" ON "PermissionCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionCategory_key_key" ON "PermissionCategory"("key");

-- CreateIndex
CREATE INDEX "PermissionCategory_sortOrder_idx" ON "PermissionCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_categoryId_idx" ON "Permission"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE INDEX "Role_isSystem_idx" ON "Role"("isSystem");

-- CreateIndex
CREATE INDEX "Role_scope_idx" ON "Role"("scope");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_baseRoleId_idx" ON "User"("baseRoleId");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_descriptionCatalogId_idx" ON "Team"("descriptionCatalogId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Project_template_idx" ON "Project"("template");

-- CreateIndex
CREATE INDEX "Project_descriptionCatalogId_idx" ON "Project"("descriptionCatalogId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "ProjectMember_roleId_idx" ON "ProjectMember"("roleId");

-- CreateIndex
CREATE INDEX "ProjectMember_membershipSource_idx" ON "ProjectMember"("membershipSource");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectTeamLink_projectId_idx" ON "ProjectTeamLink"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTeamLink_teamId_idx" ON "ProjectTeamLink"("teamId");

-- CreateIndex
CREATE INDEX "ProjectTeamLink_createdById_idx" ON "ProjectTeamLink"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamLink_projectId_teamId_key" ON "ProjectTeamLink"("projectId", "teamId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_stageId_idx" ON "Task"("stageId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_pendingActivatedAt_idx" ON "Task"("pendingActivatedAt");

-- CreateIndex
CREATE INDEX "Task_startDate_idx" ON "Task"("startDate");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_blockingTaskId_idx" ON "Task"("blockingTaskId");

-- CreateIndex
CREATE INDEX "Task_descriptionCatalogId_idx" ON "Task"("descriptionCatalogId");

-- CreateIndex
CREATE INDEX "Task_blockedReasonCatalogId_idx" ON "Task"("blockedReasonCatalogId");

-- CreateIndex
CREATE INDEX "ProjectStage_projectId_idx" ON "ProjectStage"("projectId");

-- CreateIndex
CREATE INDEX "ProjectStage_projectId_order_idx" ON "ProjectStage"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStage_projectId_name_key" ON "ProjectStage"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStage_projectId_code_key" ON "ProjectStage"("projectId", "code");

-- CreateIndex
CREATE INDEX "TaskDependency_taskId_idx" ON "TaskDependency"("taskId");

-- CreateIndex
CREATE INDEX "TaskDependency_dependsOnTaskId_idx" ON "TaskDependency"("dependsOnTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key" ON "TaskDependency"("taskId", "dependsOnTaskId");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_taskId_idx" ON "TaskStatusHistory"("taskId");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_changedById_idx" ON "TaskStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_changedAt_idx" ON "TaskStatusHistory"("changedAt");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_reasonCatalogId_idx" ON "TaskStatusHistory"("reasonCatalogId");

-- CreateIndex
CREATE INDEX "TaskReassignment_taskId_idx" ON "TaskReassignment"("taskId");

-- CreateIndex
CREATE INDEX "TaskReassignment_newAssigneeId_idx" ON "TaskReassignment"("newAssigneeId");

-- CreateIndex
CREATE INDEX "TaskReassignment_reassignedById_idx" ON "TaskReassignment"("reassignedById");

-- CreateIndex
CREATE INDEX "TaskReassignment_reasonCatalogId_idx" ON "TaskReassignment"("reasonCatalogId");

-- CreateIndex
CREATE INDEX "TaskScheduleHistory_taskId_idx" ON "TaskScheduleHistory"("taskId");

-- CreateIndex
CREATE INDEX "TaskScheduleHistory_changedById_idx" ON "TaskScheduleHistory"("changedById");

-- CreateIndex
CREATE INDEX "TaskScheduleHistory_changedAt_idx" ON "TaskScheduleHistory"("changedAt");

-- CreateIndex
CREATE INDEX "TaskScheduleHistory_reasonCatalogId_idx" ON "TaskScheduleHistory"("reasonCatalogId");

-- CreateIndex
CREATE INDEX "OnboardingChecklistItem_checklistId_idx" ON "OnboardingChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "OnboardingChecklistItem_order_idx" ON "OnboardingChecklistItem"("order");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklistItem_checklistId_stepKey_key" ON "OnboardingChecklistItem"("checklistId", "stepKey");

-- CreateIndex
CREATE INDEX "OnboardingRun_checklistId_idx" ON "OnboardingRun"("checklistId");

-- CreateIndex
CREATE INDEX "OnboardingRun_userId_idx" ON "OnboardingRun"("userId");

-- CreateIndex
CREATE INDEX "OnboardingRunStep_runId_idx" ON "OnboardingRunStep"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRunStep_runId_stepKey_key" ON "OnboardingRunStep"("runId", "stepKey");

-- CreateIndex
CREATE INDEX "OffboardingRecord_userId_idx" ON "OffboardingRecord"("userId");

-- CreateIndex
CREATE INDEX "OffboardingRecord_transferToUserId_idx" ON "OffboardingRecord"("transferToUserId");

-- CreateIndex
CREATE INDEX "OffboardingRecord_reasonCatalogId_idx" ON "OffboardingRecord"("reasonCatalogId");

-- CreateIndex
CREATE INDEX "GuestInvite_projectId_idx" ON "GuestInvite"("projectId");

-- CreateIndex
CREATE INDEX "GuestInvite_fileId_idx" ON "GuestInvite"("fileId");

-- CreateIndex
CREATE INDEX "GuestInvite_documentId_idx" ON "GuestInvite"("documentId");

-- CreateIndex
CREATE INDEX "GuestInvite_email_idx" ON "GuestInvite"("email");

-- CreateIndex
CREATE INDEX "GuestInvite_expiresAt_idx" ON "GuestInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "GuestInvite_createdById_idx" ON "GuestInvite"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "InternalInvite_tokenHash_key" ON "InternalInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "InternalInvite_email_idx" ON "InternalInvite"("email");

-- CreateIndex
CREATE INDEX "InternalInvite_expiresAt_idx" ON "InternalInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "InternalInvite_createdById_idx" ON "InternalInvite"("createdById");

-- CreateIndex
CREATE INDEX "InternalInvite_baseRoleId_idx" ON "InternalInvite"("baseRoleId");

-- CreateIndex
CREATE INDEX "InternalInvite_teamId_idx" ON "InternalInvite"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonProfile_userId_key" ON "PersonProfile"("userId");

-- CreateIndex
CREATE INDEX "PersonProfile_userId_idx" ON "PersonProfile"("userId");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_userId_idx" ON "AvailabilityBlock"("userId");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_type_idx" ON "AvailabilityBlock"("type");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_startAt_endAt_idx" ON "AvailabilityBlock"("startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_userId_key" ON "WorkSchedule"("userId");

-- CreateIndex
CREATE INDEX "WorkSchedule_userId_idx" ON "WorkSchedule"("userId");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");

-- CreateIndex
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");

-- CreateIndex
CREATE INDEX "TimeEntry_loggedAt_idx" ON "TimeEntry"("loggedAt");

-- CreateIndex
CREATE INDEX "Channel_teamId_idx" ON "Channel"("teamId");

-- CreateIndex
CREATE INDEX "Channel_projectId_idx" ON "Channel"("projectId");

-- CreateIndex
CREATE INDEX "Channel_scope_idx" ON "Channel"("scope");

-- CreateIndex
CREATE INDEX "ChannelMember_channelId_idx" ON "ChannelMember"("channelId");

-- CreateIndex
CREATE INDEX "ChannelMember_userId_idx" ON "ChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMember_channelId_userId_key" ON "ChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "Message_channelId_idx" ON "Message"("channelId");

-- CreateIndex
CREATE INDEX "Message_authorId_idx" ON "Message"("authorId");

-- CreateIndex
CREATE INDEX "Message_kind_idx" ON "Message"("kind");

-- CreateIndex
CREATE INDEX "Message_meetingId_idx" ON "Message"("meetingId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MessageAttachment_createdAt_idx" ON "MessageAttachment"("createdAt");

-- CreateIndex
CREATE INDEX "Meeting_projectId_idx" ON "Meeting"("projectId");

-- CreateIndex
CREATE INDEX "Meeting_teamId_idx" ON "Meeting"("teamId");

-- CreateIndex
CREATE INDEX "Meeting_createdById_idx" ON "Meeting"("createdById");

-- CreateIndex
CREATE INDEX "Meeting_startsAt_endsAt_idx" ON "Meeting"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Meeting_descriptionCatalogId_idx" ON "Meeting"("descriptionCatalogId");

-- CreateIndex
CREATE INDEX "MeetingParticipant_meetingId_idx" ON "MeetingParticipant"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingParticipant_userId_idx" ON "MeetingParticipant"("userId");

-- CreateIndex
CREATE INDEX "MeetingParticipant_roleId_idx" ON "MeetingParticipant"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingParticipant_meetingId_userId_key" ON "MeetingParticipant"("meetingId", "userId");

-- CreateIndex
CREATE INDEX "MeetingAgendaItem_meetingId_idx" ON "MeetingAgendaItem"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAgendaItem_meetingId_order_key" ON "MeetingAgendaItem"("meetingId", "order");

-- CreateIndex
CREATE INDEX "MeetingNote_meetingId_idx" ON "MeetingNote"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingNote_authorId_idx" ON "MeetingNote"("authorId");

-- CreateIndex
CREATE INDEX "MeetingAgreement_meetingId_idx" ON "MeetingAgreement"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingAgreement_authorId_idx" ON "MeetingAgreement"("authorId");

-- CreateIndex
CREATE INDEX "MeetingAgreement_taskId_idx" ON "MeetingAgreement"("taskId");

-- CreateIndex
CREATE INDEX "MeetingAgreement_status_idx" ON "MeetingAgreement"("status");

-- CreateIndex
CREATE INDEX "MeetingAgreement_descriptionCatalogId_idx" ON "MeetingAgreement"("descriptionCatalogId");

-- CreateIndex
CREATE INDEX "ExternalCalendarConnection_userId_idx" ON "ExternalCalendarConnection"("userId");

-- CreateIndex
CREATE INDEX "ExternalCalendarConnection_provider_idx" ON "ExternalCalendarConnection"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendarConnection_provider_externalAccountId_key" ON "ExternalCalendarConnection"("provider", "externalAccountId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_connectionId_idx" ON "ExternalCalendarEvent"("connectionId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_projectId_idx" ON "ExternalCalendarEvent"("projectId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_teamId_idx" ON "ExternalCalendarEvent"("teamId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_startsAt_endsAt_idx" ON "ExternalCalendarEvent"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendarEvent_connectionId_externalId_key" ON "ExternalCalendarEvent"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_event_channel_key" ON "NotificationPreference"("userId", "event", "channel");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_event_idx" ON "Notification"("event");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "Notification_deliveredAt_idx" ON "Notification"("deliveredAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- CreateIndex
CREATE INDEX "Announcement_createdById_idx" ON "Announcement"("createdById");

-- CreateIndex
CREATE INDEX "AnnouncementTeam_announcementId_idx" ON "AnnouncementTeam"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementTeam_teamId_idx" ON "AnnouncementTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementTeam_announcementId_teamId_key" ON "AnnouncementTeam"("announcementId", "teamId");

-- CreateIndex
CREATE INDEX "AnnouncementUser_announcementId_idx" ON "AnnouncementUser"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementUser_userId_idx" ON "AnnouncementUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementUser_announcementId_userId_key" ON "AnnouncementUser"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "FormRequest_requesterId_idx" ON "FormRequest"("requesterId");

-- CreateIndex
CREATE INDEX "FormRequest_approverId_idx" ON "FormRequest"("approverId");

-- CreateIndex
CREATE INDEX "FormRequest_status_idx" ON "FormRequest"("status");

-- CreateIndex
CREATE INDEX "Folder_teamId_idx" ON "Folder"("teamId");

-- CreateIndex
CREATE INDEX "Folder_projectId_idx" ON "Folder"("projectId");

-- CreateIndex
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

-- CreateIndex
CREATE INDEX "Folder_createdById_idx" ON "Folder"("createdById");

-- CreateIndex
CREATE INDEX "ProjectDocumentSpace_projectId_idx" ON "ProjectDocumentSpace"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborativeDocument_yDocName_key" ON "CollaborativeDocument"("yDocName");

-- CreateIndex
CREATE INDEX "CollaborativeDocument_projectId_type_updatedAt_idx" ON "CollaborativeDocument"("projectId", "type", "updatedAt");

-- CreateIndex
CREATE INDEX "CollaborativeDocument_deletedAt_purgeAt_idx" ON "CollaborativeDocument"("deletedAt", "purgeAt");

-- CreateIndex
CREATE INDEX "CollaborativeDocumentVersion_documentId_versionNumber_idx" ON "CollaborativeDocumentVersion"("documentId", "versionNumber" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CollaborativeDocumentVersion_documentId_versionNumber_key" ON "CollaborativeDocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "DocumentAsset_documentId_createdAt_idx" ON "DocumentAsset"("documentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentAsset_createdById_idx" ON "DocumentAsset"("createdById");

-- CreateIndex
CREATE INDEX "FileObject_folderId_idx" ON "FileObject"("folderId");

-- CreateIndex
CREATE INDEX "FileObject_ownerId_idx" ON "FileObject"("ownerId");

-- CreateIndex
CREATE INDEX "FileObject_deletedAt_idx" ON "FileObject"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileTrash_fileId_key" ON "FileTrash"("fileId");

-- CreateIndex
CREATE INDEX "FileTrash_scheduledPurgeAt_idx" ON "FileTrash"("scheduledPurgeAt");

-- CreateIndex
CREATE UNIQUE INDEX "StorageQuota_userId_key" ON "StorageQuota"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageQuota_teamId_key" ON "StorageQuota"("teamId");

-- CreateIndex
CREATE INDEX "StorageQuota_userId_idx" ON "StorageQuota"("userId");

-- CreateIndex
CREATE INDEX "StorageQuota_teamId_idx" ON "StorageQuota"("teamId");

-- CreateIndex
CREATE INDEX "DecisionNote_authorId_idx" ON "DecisionNote"("authorId");

-- CreateIndex
CREATE INDEX "DecisionNote_linkedEntityType_linkedEntityId_idx" ON "DecisionNote"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "DecisionNote_descriptionCatalogId_idx" ON "DecisionNote"("descriptionCatalogId");

-- CreateIndex
CREATE INDEX "AutomationRule_projectId_idx" ON "AutomationRule"("projectId");

-- CreateIndex
CREATE INDEX "AutomationRule_createdById_idx" ON "AutomationRule"("createdById");

-- CreateIndex
CREATE INDEX "AutomationRule_enabled_idx" ON "AutomationRule"("enabled");

-- CreateIndex
CREATE INDEX "Objective_teamId_idx" ON "Objective"("teamId");

-- CreateIndex
CREATE INDEX "Objective_projectId_idx" ON "Objective"("projectId");

-- CreateIndex
CREATE INDEX "Objective_ownerId_idx" ON "Objective"("ownerId");

-- CreateIndex
CREATE INDEX "Objective_descriptionCatalogId_idx" ON "Objective"("descriptionCatalogId");

-- CreateIndex
CREATE INDEX "ObjectiveTask_objectiveId_idx" ON "ObjectiveTask"("objectiveId");

-- CreateIndex
CREATE INDEX "ObjectiveTask_taskId_idx" ON "ObjectiveTask"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveTask_objectiveId_taskId_key" ON "ObjectiveTask"("objectiveId", "taskId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_createdById_idx" ON "WebhookEndpoint"("createdById");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_event_idx" ON "WebhookEndpoint"("event");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_idx" ON "WebhookDelivery"("endpointId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_attemptedAt_idx" ON "WebhookDelivery"("attemptedAt");

-- CreateIndex
CREATE INDEX "ImportJob_createdById_idx" ON "ImportJob"("createdById");

-- CreateIndex
CREATE INDEX "ImportJob_source_idx" ON "ImportJob"("source");

-- CreateIndex
CREATE INDEX "ImportError_jobId_idx" ON "ImportError"("jobId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_reasonCatalogId_idx" ON "AuditLog"("reasonCatalogId");

-- CreateIndex
CREATE INDEX "TaskCodeCatalog_field_isActive_idx" ON "TaskCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCodeCatalog_field_code_key" ON "TaskCodeCatalog"("field", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCodeCatalog_field_key_key" ON "TaskCodeCatalog"("field", "key");

-- CreateIndex
CREATE INDEX "ProjectCodeCatalog_field_isActive_idx" ON "ProjectCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCodeCatalog_field_code_key" ON "ProjectCodeCatalog"("field", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCodeCatalog_field_key_key" ON "ProjectCodeCatalog"("field", "key");

-- CreateIndex
CREATE INDEX "TeamCodeCatalog_field_isActive_idx" ON "TeamCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TeamCodeCatalog_field_code_key" ON "TeamCodeCatalog"("field", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TeamCodeCatalog_field_key_key" ON "TeamCodeCatalog"("field", "key");

-- CreateIndex
CREATE INDEX "MeetingCodeCatalog_field_isActive_idx" ON "MeetingCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingCodeCatalog_field_code_key" ON "MeetingCodeCatalog"("field", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingCodeCatalog_field_key_key" ON "MeetingCodeCatalog"("field", "key");

-- CreateIndex
CREATE INDEX "ObjectiveCodeCatalog_field_isActive_idx" ON "ObjectiveCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveCodeCatalog_field_code_key" ON "ObjectiveCodeCatalog"("field", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveCodeCatalog_field_key_key" ON "ObjectiveCodeCatalog"("field", "key");

-- CreateIndex
CREATE INDEX "DecisionCodeCatalog_field_isActive_idx" ON "DecisionCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionCodeCatalog_field_code_key" ON "DecisionCodeCatalog"("field", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionCodeCatalog_field_key_key" ON "DecisionCodeCatalog"("field", "key");

-- CreateIndex
CREATE INDEX "IdentityCodeCatalog_field_isActive_idx" ON "IdentityCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCodeCatalog_field_code_key" ON "IdentityCodeCatalog"("field", "code");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCodeCatalog_field_key_key" ON "IdentityCodeCatalog"("field", "key");

-- CreateIndex
CREATE INDEX "AuditCodeCatalog_field_isActive_idx" ON "AuditCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditCodeCatalog_field_code_key" ON "AuditCodeCatalog"("field", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AuditCodeCatalog_field_key_key" ON "AuditCodeCatalog"("field", "key");

-- CreateIndex
CREATE INDEX "ProjectDetail_projectId_idx" ON "ProjectDetail"("projectId");

-- CreateIndex
CREATE INDEX "Expense_projectDetailId_idx" ON "Expense"("projectDetailId");

-- CreateIndex
CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PermissionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_baseRoleId_fkey" FOREIGN KEY ("baseRoleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_descriptionCatalogId_fkey" FOREIGN KEY ("descriptionCatalogId") REFERENCES "TeamCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_descriptionCatalogId_fkey" FOREIGN KEY ("descriptionCatalogId") REFERENCES "ProjectCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamLink" ADD CONSTRAINT "ProjectTeamLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamLink" ADD CONSTRAINT "ProjectTeamLink_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamLink" ADD CONSTRAINT "ProjectTeamLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProjectStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_descriptionCatalogId_fkey" FOREIGN KEY ("descriptionCatalogId") REFERENCES "TaskCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_blockedReasonCatalogId_fkey" FOREIGN KEY ("blockedReasonCatalogId") REFERENCES "TaskCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_blockingTaskId_fkey" FOREIGN KEY ("blockingTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusHistory" ADD CONSTRAINT "TaskStatusHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusHistory" ADD CONSTRAINT "TaskStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusHistory" ADD CONSTRAINT "TaskStatusHistory_reasonCatalogId_fkey" FOREIGN KEY ("reasonCatalogId") REFERENCES "TaskCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReassignment" ADD CONSTRAINT "TaskReassignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReassignment" ADD CONSTRAINT "TaskReassignment_reassignedById_fkey" FOREIGN KEY ("reassignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReassignment" ADD CONSTRAINT "TaskReassignment_reasonCatalogId_fkey" FOREIGN KEY ("reasonCatalogId") REFERENCES "TaskCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskScheduleHistory" ADD CONSTRAINT "TaskScheduleHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskScheduleHistory" ADD CONSTRAINT "TaskScheduleHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskScheduleHistory" ADD CONSTRAINT "TaskScheduleHistory_reasonCatalogId_fkey" FOREIGN KEY ("reasonCatalogId") REFERENCES "TaskCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "OnboardingChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRun" ADD CONSTRAINT "OnboardingRun_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "OnboardingChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRun" ADD CONSTRAINT "OnboardingRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRunStep" ADD CONSTRAINT "OnboardingRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OnboardingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingRecord" ADD CONSTRAINT "OffboardingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingRecord" ADD CONSTRAINT "OffboardingRecord_transferToUserId_fkey" FOREIGN KEY ("transferToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingRecord" ADD CONSTRAINT "OffboardingRecord_reasonCatalogId_fkey" FOREIGN KEY ("reasonCatalogId") REFERENCES "IdentityCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborativeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalInvite" ADD CONSTRAINT "InternalInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalInvite" ADD CONSTRAINT "InternalInvite_baseRoleId_fkey" FOREIGN KEY ("baseRoleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalInvite" ADD CONSTRAINT "InternalInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonProfile" ADD CONSTRAINT "PersonProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityBlock" ADD CONSTRAINT "AvailabilityBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_descriptionCatalogId_fkey" FOREIGN KEY ("descriptionCatalogId") REFERENCES "MeetingCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgreement" ADD CONSTRAINT "MeetingAgreement_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgreement" ADD CONSTRAINT "MeetingAgreement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgreement" ADD CONSTRAINT "MeetingAgreement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgreement" ADD CONSTRAINT "MeetingAgreement_descriptionCatalogId_fkey" FOREIGN KEY ("descriptionCatalogId") REFERENCES "MeetingCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarConnection" ADD CONSTRAINT "ExternalCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExternalCalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementTeam" ADD CONSTRAINT "AnnouncementTeam_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementTeam" ADD CONSTRAINT "AnnouncementTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementUser" ADD CONSTRAINT "AnnouncementUser_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementUser" ADD CONSTRAINT "AnnouncementUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRequest" ADD CONSTRAINT "FormRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRequest" ADD CONSTRAINT "FormRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocumentSpace" ADD CONSTRAINT "ProjectDocumentSpace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocument" ADD CONSTRAINT "CollaborativeDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocument" ADD CONSTRAINT "CollaborativeDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocument" ADD CONSTRAINT "CollaborativeDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocumentVersion" ADD CONSTRAINT "CollaborativeDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborativeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocumentVersion" ADD CONSTRAINT "CollaborativeDocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAsset" ADD CONSTRAINT "DocumentAsset_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborativeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAsset" ADD CONSTRAINT "DocumentAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileTrash" ADD CONSTRAINT "FileTrash_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageQuota" ADD CONSTRAINT "StorageQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageQuota" ADD CONSTRAINT "StorageQuota_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_descriptionCatalogId_fkey" FOREIGN KEY ("descriptionCatalogId") REFERENCES "DecisionCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_descriptionCatalogId_fkey" FOREIGN KEY ("descriptionCatalogId") REFERENCES "ObjectiveCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveTask" ADD CONSTRAINT "ObjectiveTask_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveTask" ADD CONSTRAINT "ObjectiveTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_reasonCatalogId_fkey" FOREIGN KEY ("reasonCatalogId") REFERENCES "AuditCodeCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDetail" ADD CONSTRAINT "ProjectDetail_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDetail" ADD CONSTRAINT "ProjectDetail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectDetailId_fkey" FOREIGN KEY ("projectDetailId") REFERENCES "ProjectDetail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

