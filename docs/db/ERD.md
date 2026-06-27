# ERD de Corelia

Diagrama entidad-relacion generado desde `apps/api/prisma/schema.prisma`.

## Como visualizar

- GitHub y varios editores Markdown renderizan el bloque Mermaid de este archivo.
- Si el render es pesado por el tamano del esquema, abre `docs/db/corelia-er.mmd` en Mermaid Live Editor o en un plugin de Mermaid.
- Tambien existen diagramas PlantUML por dominio en `docs/db/puml/`:
  - `corelia-global.puml`
  - `corelia-rbac.puml`
  - `corelia-projects-tasks.puml`
  - `corelia-meetings-messaging.puml`
  - `corelia-documents-files.puml`
  - `corelia-admin-audit-integrations.puml`

## Diagrama Mermaid

```mermaid
erDiagram
  %% Generado desde apps/api/prisma/schema.prisma
  %% PK = primary key, FK = foreign key, UK = unique key
  PermissionCategory {
    String id "PK"
    Int code "UK"
    String key "UK"
    String displayName
    String description "nullable"
    Int sortOrder
    DateTime createdAt
    DateTime updatedAt
  }
  Program {
    String id "PK"
    Int code "UK"
    String key "UK"
    String displayName
    String description "nullable"
    Int sortOrder
    Boolean isSystem
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  Permission {
    String id "PK"
    Int code "UK"
    String key "UK"
    String displayName
    String description "nullable"
    String programId "FK"
    String categoryId "FK"
    Boolean isSystem
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  Role {
    String id "PK"
    Int code "UK"
    String key "UK"
    String displayName
    String description "nullable"
    Boolean isSystem
    RoleScope scope
    Int rank
    DateTime createdAt
    DateTime updatedAt
  }
  RolePermission {
    String roleId "PK, FK"
    String permissionId "PK, FK"
    DateTime createdAt
  }
  ProgramRole {
    String programId "PK, FK"
    String roleId "PK, FK"
    DateTime createdAt
  }
  User {
    String id "PK"
    String email "UK"
    String passwordHash
    String firstName
    String lastName
    String baseRoleId "FK"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
    DateTime deactivatedAt "nullable"
  }
  Team {
    String id "PK"
    String name "UK"
    String description "nullable"
    String descriptionCatalogId "FK, nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  TeamMember {
    String id "PK"
    String teamId "FK"
    String userId "FK"
    DateTime createdAt
  }
  Project {
    String id "PK"
    String name
    String description "nullable"
    String descriptionCatalogId "FK, nullable"
    ProjectTemplate template
    String ownerId "FK"
    DateTime startDate "nullable"
    DateTime estimatedEndDate "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  ProjectMember {
    String id "PK"
    String projectId "FK"
    String userId "FK"
    String roleId "FK"
    ProjectMembershipSource membershipSource
    Int syncTeamsCount
    DateTime joinedAt
  }
  ProjectTeamLink {
    String id "PK"
    String projectId "FK"
    String teamId "FK"
    String createdById "FK"
    DateTime createdAt
    DateTime updatedAt
  }
  Task {
    String id "PK"
    String projectId "FK"
    String stageId "FK, nullable"
    String title
    String description "nullable"
    String descriptionCatalogId "FK, nullable"
    String assigneeId "FK, nullable"
    String createdById "FK"
    TaskStatus status
    DateTime pendingActivatedAt "nullable"
    DateTime startDate "nullable"
    DateTime dueDate "nullable"
    String blockingTaskId "FK, nullable"
    String blockedReason "nullable"
    String blockedReasonCatalogId "FK, nullable"
    DateTime completedAt "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  ProjectStage {
    String id "PK"
    String projectId "FK"
    Int code
    String name
    String color
    Int order
    DateTime createdAt
    DateTime updatedAt
  }
  TaskDependency {
    String id "PK"
    String taskId "FK"
    String dependsOnTaskId "FK"
    DateTime createdAt
  }
  TaskStatusHistory {
    String id "PK"
    String taskId "FK"
    TaskStatus fromStatus "nullable"
    TaskStatus toStatus
    String reason
    String reasonCatalogId "FK, nullable"
    String changedById "FK"
    DateTime changedAt
  }
  TaskReassignment {
    String id "PK"
    String taskId "FK"
    String previousAssigneeId "nullable"
    String newAssigneeId
    String reason
    String reasonCatalogId "FK, nullable"
    String reassignedById "FK"
    DateTime reassignedAt
  }
  TaskScheduleHistory {
    String id "PK"
    String taskId "FK"
    DateTime previousStartDate "nullable"
    DateTime previousDueDate "nullable"
    DateTime newStartDate "nullable"
    DateTime newDueDate "nullable"
    String reason
    String reasonCatalogId "FK, nullable"
    String changedById "FK"
    DateTime changedAt
  }
  OnboardingChecklist {
    String id "PK"
    String name
    Boolean isDefault
    DateTime createdAt
  }
  OnboardingChecklistItem {
    String id "PK"
    String checklistId "FK"
    String stepKey
    String label
    Boolean required
    Int order
  }
  OnboardingRun {
    String id "PK"
    String checklistId "FK"
    String userId "FK"
    DateTime startedAt
    DateTime completedAt "nullable"
  }
  OnboardingRunStep {
    String id "PK"
    String runId "FK"
    String stepKey
    Boolean completed
    DateTime completedAt "nullable"
  }
  OffboardingRecord {
    String id "PK"
    String userId "FK"
    String transferToUserId "FK"
    String reason
    String reasonCatalogId "FK, nullable"
    DateTime revokedAt
    DateTime archivedAt "nullable"
  }
  GuestInvite {
    String id "PK"
    String email
    String tokenHash
    String projectId "FK, nullable"
    String fileId "FK, nullable"
    String documentId "FK, nullable"
    DateTime expiresAt
    String createdById "FK"
    DateTime acceptedAt "nullable"
    DateTime revokedAt "nullable"
    DateTime createdAt
  }
  InternalInvite {
    String id "PK"
    String email
    String tokenHash "UK"
    String baseRoleId "FK"
    String teamId "FK, nullable"
    DateTime expiresAt
    String createdById "FK"
    DateTime acceptedAt "nullable"
    DateTime revokedAt "nullable"
    DateTime createdAt
    DateTime resentAt "nullable"
  }
  SignupRequest {
    String id "PK"
    String email
    String firstName
    String lastName
    String message "nullable"
    SignupRequestStatus status
    DateTime requestedAt
    DateTime reviewedAt "nullable"
    String reviewedById "FK, nullable"
    String decisionNote "nullable"
    String inviteId "UK, FK, nullable"
  }
  PersonProfile {
    String id "PK"
    String userId "UK, FK"
    String internalContactEmail
    String internalPhone "nullable"
    String timezone "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  AvailabilityBlock {
    String id "PK"
    String userId "FK"
    AvailabilityType type
    DateTime startAt
    DateTime endAt
    String note "nullable"
    DateTime createdAt
  }
  WorkSchedule {
    String id "PK"
    String userId "UK, FK"
    String timezone
    String startHour
    String endHour
    Int maxActiveTasks
    Float periodHoursCapacity
    DateTime createdAt
    DateTime updatedAt
  }
  TimeEntry {
    String id "PK"
    String userId "FK"
    String taskId "FK"
    Int minutes
    String note "nullable"
    DateTime loggedAt
  }
  Channel {
    String id "PK"
    String name
    ChannelScope scope
    String teamId "FK, nullable"
    String projectId "FK, nullable"
    DateTime createdAt
  }
  ChannelMember {
    String id "PK"
    String channelId "FK"
    String userId "FK"
    DateTime joinedAt
  }
  Message {
    String id "PK"
    String channelId "FK"
    String authorId "FK"
    MessageKind kind
    String content
    String meetingId "FK, nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  MessageAttachment {
    String id "PK"
    String messageId "FK"
    String originalName
    String mimeType
    Int sizeBytes
    String minioPath
    DateTime createdAt
  }
  Meeting {
    String id "PK"
    String title
    String description "nullable"
    String descriptionCatalogId "FK, nullable"
    String projectId "FK, nullable"
    String teamId "FK, nullable"
    DateTime startsAt
    DateTime endsAt
    String createdById "FK"
    MeetingStatus status
    MeetingCallType callType
    String mediaRoomId "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  MeetingParticipant {
    String id "PK"
    String meetingId "FK"
    String userId "FK"
    String roleId "FK, nullable"
    Boolean muted
    Boolean cameraOn
    Boolean screenSharing
    Boolean speaking
    DateTime joinedAt "nullable"
    DateTime leftAt "nullable"
    DateTime createdAt
  }
  MeetingAgendaItem {
    String id "PK"
    String meetingId "FK"
    String text
    Int order
    DateTime createdAt
  }
  MeetingNote {
    String id "PK"
    String meetingId "FK"
    String authorId "FK"
    String content
    String metadata "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  MeetingAgreement {
    String id "PK"
    String meetingId "FK"
    String title
    String description "nullable"
    String descriptionCatalogId "FK, nullable"
    MeetingAgreementStatus status
    String authorId "FK"
    String taskId "FK, nullable"
    Boolean createdTask
    DateTime createdAt
    DateTime updatedAt
  }
  ExternalCalendarConnection {
    String id "PK"
    String userId "FK"
    ExternalCalendarProvider provider
    String externalAccountId
    String accessTokenEncrypted
    String refreshTokenEncrypted "nullable"
    DateTime expiresAt "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  ExternalCalendarEvent {
    String id "PK"
    String connectionId "FK"
    String externalId
    String title
    DateTime startsAt
    DateTime endsAt
    Boolean readOnly
    String projectId "FK, nullable"
    String teamId "FK, nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  NotificationPreference {
    String id "PK"
    String userId "FK"
    NotificationEvent event
    NotificationChannel channel
    NotificationFrequency frequency
    Boolean enabled
  }
  Notification {
    String id "PK"
    String userId "FK"
    NotificationEvent event
    NotificationChannel channel
    NotificationPriority priority
    String groupKey "nullable"
    String title
    String body
    DateTime sentAt "nullable"
    DateTime deliveredAt "nullable"
    DateTime readAt "nullable"
    DateTime createdAt
  }
  BrowserPushSubscription {
    String id "PK"
    String userId "FK"
    String endpoint "UK"
    String p256dh
    String auth
    DateTime expirationTime "nullable"
    String userAgent "nullable"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
    DateTime lastSeenAt
  }
  Announcement {
    String id "PK"
    String title
    String body
    Boolean allCompany
    TipoProgramacionAnuncio scheduleType
    DateTime startsAt "nullable"
    DateTime expiresAt
    Int recurringMonth "nullable"
    Int recurringDay "nullable"
    String createdById "FK"
    DateTime createdAt
  }
  AnnouncementTeam {
    String id "PK"
    String announcementId "FK"
    String teamId "FK"
  }
  AnnouncementUser {
    String id "PK"
    String announcementId "FK"
    String userId "FK"
  }
  FormRequest {
    String id "PK"
    String requesterId "FK"
    RequestType type
    String payload
    RequestStatus status
    String approverId "FK, nullable"
    String comment "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  DynamicForm {
    String id "PK"
    String title
    String description "nullable"
    String createdById "FK"
    String projectId "FK, nullable"
    Boolean isActive
    Boolean allowMultipleSubmissions
    Boolean isAnonymous
    DateTime createdAt
    DateTime updatedAt
  }
  DynamicFormQuestion {
    String id "PK"
    String formId "FK"
    DynamicFormQuestionType type
    String label
    Boolean required
    Json options "nullable"
    Int order
    Json conditionalLogic "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  DynamicFormResponse {
    String id "PK"
    String formId "FK"
    String userId "FK, nullable"
    DateTime submittedAt
  }
  DynamicFormAnswer {
    String id "PK"
    String responseId "FK"
    String questionId "FK"
    Json value
  }
  Folder {
    String id "PK"
    String name
    FolderScope scope
    String teamId "FK, nullable"
    String projectId "FK, nullable"
    String parentId "FK, nullable"
    String createdById "FK"
    DateTime createdAt
  }
  ProjectDocumentSpace {
    String projectId "PK, FK"
    String rootFolderId
    String textoFolderId
    String diagramasFolderId
    String tablasFolderId
    String whiteboardFolderId
    String presentacionesFolderId
    DateTime createdAt
    DateTime updatedAt
  }
  CollaborativeDocument {
    String id "PK"
    String projectId "FK"
    String folderId "FK"
    DocumentType type
    String name
    String yDocName "UK"
    DiagramEngine diagramEngine "nullable"
    DiagramKind diagramKind "nullable"
    Int currentVersion
    String createdById "FK"
    DateTime deletedAt "nullable"
    DateTime purgeAt "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  CollaborativeDocumentVersion {
    String id "PK"
    String documentId "FK"
    Int versionNumber
    DocumentVersionKind kind
    String snapshotPath
    Int snapshotSizeBytes
    String createdById "FK"
    DateTime createdAt
  }
  DocumentAsset {
    String id "PK"
    String documentId "FK"
    String createdById "FK"
    String originalName
    String mimeType
    Int sizeBytes
    String minioPath
    DateTime createdAt
  }
  DocumentFavorite {
    String id "PK"
    String documentId "FK"
    String userId "FK"
    DateTime createdAt
  }
  DocumentTemplate {
    String id "PK"
    String projectId "FK, nullable"
    DocumentType type
    String name
    String description "nullable"
    String snapshotPath
    String createdById "FK"
    DateTime createdAt
  }
  DocumentCollabSession {
    String id "PK"
    String documentId "FK"
    String roomName
    DocumentCollabSessionStatus status
    Int revision
    String latestSnapshotPath "nullable"
    String latestSnapshotHash "nullable"
    Int latestSnapshotSizeBytes "nullable"
    DateTime latestSnapshotAt "nullable"
    DateTime startedAt
    DateTime lastActivityAt
    DateTime endedAt "nullable"
  }
  DocumentCollabParticipant {
    String id "PK"
    String sessionId "FK"
    String userId "FK"
    String clientId
    DocumentCollabParticipantStatus status
    DateTime joinedAt
    DateTime leftAt "nullable"
    DateTime lastHeartbeatAt "nullable"
  }
  DocumentCollabEvent {
    String id "PK"
    String sessionId "FK"
    String userId "FK, nullable"
    String clientId "nullable"
    DocumentCollabEventType type
    Json payload "nullable"
    DateTime createdAt
  }
  FileObject {
    String id "PK"
    String folderId "FK"
    String ownerId "FK"
    String originalName
    String mimeType
    Int sizeBytes
    String minioPath
    DateTime deletedAt "nullable"
    DateTime createdAt
  }
  FileTrash {
    String id "PK"
    String fileId "UK, FK"
    DateTime scheduledPurgeAt
    DateTime createdAt
  }
  StorageQuota {
    String id "PK"
    String userId "UK, FK, nullable"
    String teamId "UK, FK, nullable"
    BigInt bytesLimit
    Float alertThresholdPct
    DateTime createdAt
  }
  DecisionNote {
    String id "PK"
    String title
    String description
    String descriptionCatalogId "FK, nullable"
    String authorId "FK"
    DateTime createdAt
    String linkedUserId "FK, nullable"
    String linkedProjectId "FK, nullable"
    String linkedTaskId "FK, nullable"
    String linkedMeetingId "FK, nullable"
    String linkedMeetingAgreementId "FK, nullable"
    String linkedMessageId "FK, nullable"
    String linkedFileId "FK, nullable"
    String linkedFormRequestId "FK, nullable"
    String linkedAnnouncementId "FK, nullable"
    String linkedObjectiveId "FK, nullable"
    String linkedDecisionId "FK, nullable"
    String linkedAutomationRuleId "FK, nullable"
    String linkedExpenseId "FK, nullable"
  }
  AutomationRule {
    String id "PK"
    String projectId "FK"
    String name
    AutomationEvent event
    AutomationAction action
    Boolean enabled
    String createdById "FK"
    DateTime createdAt
    String config "nullable"
  }
  Objective {
    String id "PK"
    ObjectiveScope scope
    String teamId "FK, nullable"
    String projectId "FK, nullable"
    String title
    String description "nullable"
    String descriptionCatalogId "FK, nullable"
    String ownerId "FK"
    DateTime targetDate
    Float progressPct
    DateTime createdAt
  }
  ObjectiveTask {
    String id "PK"
    String objectiveId "FK"
    String taskId "FK"
  }
  WebhookEndpoint {
    String id "PK"
    String url
    WebhookEvent event
    String secret
    Boolean enabled
    String createdById "FK"
    DateTime createdAt
  }
  WebhookDelivery {
    String id "PK"
    String endpointId "FK"
    String payload
    Int statusCode "nullable"
    Boolean success
    DateTime attemptedAt
  }
  ImportJob {
    String id "PK"
    ImportSource source
    String filename
    DateTime startedAt
    DateTime finishedAt "nullable"
    Boolean success
    String createdById "FK"
  }
  ImportError {
    String id "PK"
    String jobId "FK"
    Int rowNumber
    String field
    String message
    DateTime createdAt
  }
  RefreshToken {
    String id "PK"
    String userId "FK"
    String tokenHash
    DateTime expiresAt
    DateTime revokedAt "nullable"
    String rotatedFromId "nullable"
    DateTime createdAt
  }
  AuditLog {
    String id "PK"
    String targetUserId "FK, nullable"
    String targetProjectId "FK, nullable"
    String targetTaskId "FK, nullable"
    String targetMeetingId "FK, nullable"
    String targetMeetingAgreementId "FK, nullable"
    String targetMessageId "FK, nullable"
    String targetFileId "FK, nullable"
    String targetFormRequestId "FK, nullable"
    String targetAnnouncementId "FK, nullable"
    String targetObjectiveId "FK, nullable"
    String targetDecisionId "FK, nullable"
    String targetAutomationRuleId "FK, nullable"
    String targetExpenseId "FK, nullable"
    ActionType action
    String userId "FK, nullable"
    String previousDataText "nullable"
    String newDataText "nullable"
    String reason "nullable"
    String reasonCatalogId "FK, nullable"
    DateTime createdAt
  }
  TaskCodeCatalog {
    String id "PK"
    TaskCodeField field
    Int code
    String key
    String label
    String description "nullable"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  ProjectCodeCatalog {
    String id "PK"
    ProjectCodeField field
    Int code
    String key
    String label
    String description "nullable"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  TeamCodeCatalog {
    String id "PK"
    TeamCodeField field
    Int code
    String key
    String label
    String description "nullable"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  MeetingCodeCatalog {
    String id "PK"
    MeetingCodeField field
    Int code
    String key
    String label
    String description "nullable"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  ObjectiveCodeCatalog {
    String id "PK"
    ObjectiveCodeField field
    Int code
    String key
    String label
    String description "nullable"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  DecisionCodeCatalog {
    String id "PK"
    DecisionCodeField field
    Int code
    String key
    String label
    String description "nullable"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  IdentityCodeCatalog {
    String id "PK"
    IdentityCodeField field
    Int code
    String key
    String label
    String description "nullable"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  AuditCodeCatalog {
    String id "PK"
    AuditCodeField field
    Int code
    String key
    String label
    String description "nullable"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  MaintenanceMode {
    Int id "PK"
    Boolean enabled
    String message "nullable"
    DateTime updatedAt
  }
  FrontendSettings {
    Int id "PK"
    String organizationName
    String taskStatusColorPending
    String taskStatusColorInReview
    String taskStatusColorCompleted
    Int instantCallExpiryHours
    DateTime updatedAt
  }
  ProjectDetail {
    String id "PK"
    String projectId "FK"
    String description
    Float estimatedBudget
    String createdById "FK"
    DateTime createdAt
    DateTime updatedAt
  }
  Expense {
    String id "PK"
    String projectDetailId "FK"
    String description
    Float amount
    DateTime date
    String receiptPath "nullable"
    ExpenseStatus status
    String approvedById "FK, nullable"
    DateTime approvedAt "nullable"
    String createdById "FK"
    DateTime createdAt
    DateTime updatedAt
  }
  MessageReceipt {
    String id "PK"
    String messageId "FK"
    String userId "FK"
    MessageReceiptStatus status
    DateTime deliveredAt "nullable"
    DateTime readAt "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  Announcement ||--o{ AnnouncementTeam : "announcement (announcementId -> id)"
  Announcement ||--o{ AnnouncementUser : "announcement (announcementId -> id)"
  Announcement |o--o{ AuditLog : "targetAnnouncement (targetAnnouncementId -> id)"
  Announcement |o--o{ DecisionNote : "linkedAnnouncement (linkedAnnouncementId -> id)"
  AuditCodeCatalog |o--o{ AuditLog : "reasonCatalog (reasonCatalogId -> id)"
  AutomationRule |o--o{ AuditLog : "targetAutomationRule (targetAutomationRuleId -> id)"
  AutomationRule |o--o{ DecisionNote : "linkedAutomationRule (linkedAutomationRuleId -> id)"
  Channel ||--o{ ChannelMember : "channel (channelId -> id)"
  Channel ||--o{ Message : "channel (channelId -> id)"
  CollaborativeDocument ||--o{ CollaborativeDocumentVersion : "document (documentId -> id)"
  CollaborativeDocument ||--o{ DocumentAsset : "document (documentId -> id)"
  CollaborativeDocument ||--o{ DocumentCollabSession : "document (documentId -> id)"
  CollaborativeDocument ||--o{ DocumentFavorite : "document (documentId -> id)"
  CollaborativeDocument |o--o{ GuestInvite : "document (documentId -> id)"
  DecisionCodeCatalog |o--o{ DecisionNote : "descriptionCatalog (descriptionCatalogId -> id)"
  DecisionNote |o--o{ AuditLog : "targetDecision (targetDecisionId -> id)"
  DecisionNote |o--o{ DecisionNote : "linkedDecision (linkedDecisionId -> id)"
  DocumentCollabSession ||--o{ DocumentCollabEvent : "session (sessionId -> id)"
  DocumentCollabSession ||--o{ DocumentCollabParticipant : "session (sessionId -> id)"
  DynamicForm ||--o{ DynamicFormQuestion : "form (formId -> id)"
  DynamicForm ||--o{ DynamicFormResponse : "form (formId -> id)"
  DynamicFormQuestion ||--o{ DynamicFormAnswer : "question (questionId -> id)"
  DynamicFormResponse ||--o{ DynamicFormAnswer : "response (responseId -> id)"
  Expense |o--o{ AuditLog : "targetExpense (targetExpenseId -> id)"
  Expense |o--o{ DecisionNote : "linkedExpense (linkedExpenseId -> id)"
  ExternalCalendarConnection ||--o{ ExternalCalendarEvent : "connection (connectionId -> id)"
  FileObject |o--o{ AuditLog : "targetFile (targetFileId -> id)"
  FileObject |o--o{ DecisionNote : "linkedFile (linkedFileId -> id)"
  FileObject ||--o{ FileTrash : "file (fileId -> id)"
  FileObject |o--o{ GuestInvite : "file (fileId -> id)"
  Folder ||--o{ CollaborativeDocument : "folder (folderId -> id)"
  Folder ||--o{ FileObject : "folder (folderId -> id)"
  Folder |o--o{ Folder : "parent (parentId -> id)"
  FormRequest |o--o{ AuditLog : "targetFormRequest (targetFormRequestId -> id)"
  FormRequest |o--o{ DecisionNote : "linkedFormRequest (linkedFormRequestId -> id)"
  IdentityCodeCatalog |o--o{ OffboardingRecord : "reasonCatalog (reasonCatalogId -> id)"
  ImportJob ||--o{ ImportError : "job (jobId -> id)"
  InternalInvite |o--o{ SignupRequest : "invite (inviteId -> id)"
  Meeting |o--o{ AuditLog : "targetMeeting (targetMeetingId -> id)"
  Meeting |o--o{ DecisionNote : "linkedMeeting (linkedMeetingId -> id)"
  Meeting ||--o{ MeetingAgendaItem : "meeting (meetingId -> id)"
  Meeting ||--o{ MeetingAgreement : "meeting (meetingId -> id)"
  Meeting ||--o{ MeetingNote : "meeting (meetingId -> id)"
  Meeting ||--o{ MeetingParticipant : "meeting (meetingId -> id)"
  Meeting |o--o{ Message : "meeting (meetingId -> id)"
  MeetingAgreement |o--o{ AuditLog : "targetMeetingAgreement (targetMeetingAgreementId -> id)"
  MeetingAgreement |o--o{ DecisionNote : "linkedMeetingAgreement (linkedMeetingAgreementId -> id)"
  MeetingCodeCatalog |o--o{ Meeting : "descriptionCatalog (descriptionCatalogId -> id)"
  MeetingCodeCatalog |o--o{ MeetingAgreement : "descriptionCatalog (descriptionCatalogId -> id)"
  Message |o--o{ AuditLog : "targetMessage (targetMessageId -> id)"
  Message |o--o{ DecisionNote : "linkedMessage (linkedMessageId -> id)"
  Message ||--o{ MessageAttachment : "message (messageId -> id)"
  Message ||--o{ MessageReceipt : "message (messageId -> id)"
  Objective |o--o{ AuditLog : "targetObjective (targetObjectiveId -> id)"
  Objective |o--o{ DecisionNote : "linkedObjective (linkedObjectiveId -> id)"
  Objective ||--o{ ObjectiveTask : "objective (objectiveId -> id)"
  ObjectiveCodeCatalog |o--o{ Objective : "descriptionCatalog (descriptionCatalogId -> id)"
  OnboardingChecklist ||--o{ OnboardingChecklistItem : "checklist (checklistId -> id)"
  OnboardingChecklist ||--o{ OnboardingRun : "checklist (checklistId -> id)"
  OnboardingRun ||--o{ OnboardingRunStep : "run (runId -> id)"
  Permission ||--o| RolePermission : "permission (permissionId -> id)"
  PermissionCategory ||--o{ Permission : "category (categoryId -> id)"
  Program ||--o{ Permission : "program (programId -> id)"
  Program ||--o| ProgramRole : "program (programId -> id)"
  Project |o--o{ AuditLog : "targetProject (targetProjectId -> id)"
  Project ||--o{ AutomationRule : "project (projectId -> id)"
  Project |o--o{ Channel : "project (projectId -> id)"
  Project ||--o{ CollaborativeDocument : "project (projectId -> id)"
  Project |o--o{ DecisionNote : "linkedProject (linkedProjectId -> id)"
  Project |o--o{ DocumentTemplate : "project (projectId -> id)"
  Project |o--o{ DynamicForm : "project (projectId -> id)"
  Project |o--o{ ExternalCalendarEvent : "project (projectId -> id)"
  Project |o--o{ Folder : "project (projectId -> id)"
  Project |o--o{ GuestInvite : "project (projectId -> id)"
  Project |o--o{ Meeting : "project (projectId -> id)"
  Project |o--o{ Objective : "project (projectId -> id)"
  Project ||--o{ ProjectDetail : "project (projectId -> id)"
  Project ||--o{ ProjectDocumentSpace : "project (projectId -> id)"
  Project ||--o{ ProjectMember : "project (projectId -> id)"
  Project ||--o{ ProjectStage : "project (projectId -> id)"
  Project ||--o{ ProjectTeamLink : "project (projectId -> id)"
  Project ||--o{ Task : "project (projectId -> id)"
  ProjectCodeCatalog |o--o{ Project : "descriptionCatalog (descriptionCatalogId -> id)"
  ProjectDetail ||--o{ Expense : "projectDetail (projectDetailId -> id)"
  ProjectStage |o--o{ Task : "stage (stageId -> id)"
  Role ||--o{ InternalInvite : "baseRole (baseRoleId -> id)"
  Role |o--o{ MeetingParticipant : "role (roleId -> id)"
  Role ||--o| ProgramRole : "role (roleId -> id)"
  Role ||--o{ ProjectMember : "role (roleId -> id)"
  Role ||--o| RolePermission : "role (roleId -> id)"
  Role ||--o{ User : "baseRole (baseRoleId -> id)"
  Task |o--o{ AuditLog : "targetTask (targetTaskId -> id)"
  Task |o--o{ DecisionNote : "linkedTask (linkedTaskId -> id)"
  Task |o--o{ MeetingAgreement : "task (taskId -> id)"
  Task ||--o{ ObjectiveTask : "task (taskId -> id)"
  Task |o--o{ Task : "blockingTask (blockingTaskId -> id)"
  Task ||--o{ TaskDependency : "dependsOnTask (dependsOnTaskId -> id)"
  Task ||--o{ TaskDependency : "task (taskId -> id)"
  Task ||--o{ TaskReassignment : "task (taskId -> id)"
  Task ||--o{ TaskScheduleHistory : "task (taskId -> id)"
  Task ||--o{ TaskStatusHistory : "task (taskId -> id)"
  Task ||--o{ TimeEntry : "task (taskId -> id)"
  TaskCodeCatalog |o--o{ Task : "blockedReasonCatalog (blockedReasonCatalogId -> id)"
  TaskCodeCatalog |o--o{ Task : "descriptionCatalog (descriptionCatalogId -> id)"
  TaskCodeCatalog |o--o{ TaskReassignment : "reasonCatalog (reasonCatalogId -> id)"
  TaskCodeCatalog |o--o{ TaskScheduleHistory : "reasonCatalog (reasonCatalogId -> id)"
  TaskCodeCatalog |o--o{ TaskStatusHistory : "reasonCatalog (reasonCatalogId -> id)"
  Team ||--o{ AnnouncementTeam : "team (teamId -> id)"
  Team |o--o{ Channel : "team (teamId -> id)"
  Team |o--o{ ExternalCalendarEvent : "team (teamId -> id)"
  Team |o--o{ Folder : "team (teamId -> id)"
  Team |o--o{ InternalInvite : "team (teamId -> id)"
  Team |o--o{ Meeting : "team (teamId -> id)"
  Team |o--o{ Objective : "team (teamId -> id)"
  Team ||--o{ ProjectTeamLink : "team (teamId -> id)"
  Team |o--o{ StorageQuota : "team (teamId -> id)"
  Team ||--o{ TeamMember : "team (teamId -> id)"
  TeamCodeCatalog |o--o{ Team : "descriptionCatalog (descriptionCatalogId -> id)"
  User ||--o{ Announcement : "createdBy (createdById -> id)"
  User ||--o{ AnnouncementUser : "user (userId -> id)"
  User |o--o{ AuditLog : "targetUser (targetUserId -> id)"
  User |o--o{ AuditLog : "user (userId -> id)"
  User ||--o{ AutomationRule : "createdBy (createdById -> id)"
  User ||--o{ AvailabilityBlock : "user (userId -> id)"
  User ||--o{ BrowserPushSubscription : "user (userId -> id)"
  User ||--o{ ChannelMember : "user (userId -> id)"
  User ||--o{ CollaborativeDocument : "createdBy (createdById -> id)"
  User ||--o{ CollaborativeDocumentVersion : "createdBy (createdById -> id)"
  User ||--o{ DecisionNote : "author (authorId -> id)"
  User |o--o{ DecisionNote : "linkedUser (linkedUserId -> id)"
  User ||--o{ DocumentAsset : "createdBy (createdById -> id)"
  User |o--o{ DocumentCollabEvent : "user (userId -> id)"
  User ||--o{ DocumentCollabParticipant : "user (userId -> id)"
  User ||--o{ DocumentFavorite : "user (userId -> id)"
  User ||--o{ DocumentTemplate : "createdBy (createdById -> id)"
  User ||--o{ DynamicForm : "createdBy (createdById -> id)"
  User |o--o{ DynamicFormResponse : "user (userId -> id)"
  User |o--o{ Expense : "approvedBy (approvedById -> id)"
  User ||--o{ Expense : "createdBy (createdById -> id)"
  User ||--o{ ExternalCalendarConnection : "user (userId -> id)"
  User ||--o{ FileObject : "owner (ownerId -> id)"
  User ||--o{ Folder : "createdBy (createdById -> id)"
  User |o--o{ FormRequest : "approver (approverId -> id)"
  User ||--o{ FormRequest : "requester (requesterId -> id)"
  User ||--o{ GuestInvite : "createdBy (createdById -> id)"
  User ||--o{ ImportJob : "createdBy (createdById -> id)"
  User ||--o{ InternalInvite : "createdBy (createdById -> id)"
  User ||--o{ Meeting : "createdBy (createdById -> id)"
  User ||--o{ MeetingAgreement : "author (authorId -> id)"
  User ||--o{ MeetingNote : "author (authorId -> id)"
  User ||--o{ MeetingParticipant : "user (userId -> id)"
  User ||--o{ Message : "author (authorId -> id)"
  User ||--o{ MessageReceipt : "user (userId -> id)"
  User ||--o{ Notification : "user (userId -> id)"
  User ||--o{ NotificationPreference : "user (userId -> id)"
  User ||--o{ Objective : "owner (ownerId -> id)"
  User ||--o{ OffboardingRecord : "transferToUser (transferToUserId -> id)"
  User ||--o{ OffboardingRecord : "user (userId -> id)"
  User ||--o{ OnboardingRun : "user (userId -> id)"
  User ||--o{ PersonProfile : "user (userId -> id)"
  User ||--o{ Project : "owner (ownerId -> id)"
  User ||--o{ ProjectDetail : "createdBy (createdById -> id)"
  User ||--o{ ProjectMember : "user (userId -> id)"
  User ||--o{ ProjectTeamLink : "createdBy (createdById -> id)"
  User ||--o{ RefreshToken : "user (userId -> id)"
  User |o--o{ SignupRequest : "reviewedBy (reviewedById -> id)"
  User |o--o{ StorageQuota : "user (userId -> id)"
  User |o--o{ Task : "assignee (assigneeId -> id)"
  User ||--o{ Task : "createdBy (createdById -> id)"
  User ||--o{ TaskReassignment : "reassignedBy (reassignedById -> id)"
  User ||--o{ TaskScheduleHistory : "changedBy (changedById -> id)"
  User ||--o{ TaskStatusHistory : "changedBy (changedById -> id)"
  User ||--o{ TeamMember : "user (userId -> id)"
  User ||--o{ TimeEntry : "user (userId -> id)"
  User ||--o{ WebhookEndpoint : "createdBy (createdById -> id)"
  User ||--o{ WorkSchedule : "user (userId -> id)"
  WebhookEndpoint ||--o{ WebhookDelivery : "endpoint (endpointId -> id)"

```
