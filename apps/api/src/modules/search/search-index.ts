import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

const SEARCH_BATCH_SIZE = 250;
const SEARCH_RESULT_LIMIT = 20;
const TASK_POLL_INTERVAL_MS = 250;
const TASK_POLL_TIMEOUT_MS = 30_000;

const envBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }

  return value;
}, z.boolean());

const searchIndexEnvSchema = z.object({
  MEILISEARCH_ENABLED: envBoolean.default(false),
  MEILISEARCH_URL: z.string().url().default("http://localhost:7700"),
  MEILISEARCH_API_KEY: z.string().default(""),
  MEILISEARCH_INDEX: z.string().min(1).default("corelia-global-search"),
  MEILISEARCH_BOOTSTRAP_ON_START: envBoolean.default(true)
});

export type SearchIndexEnv = z.infer<typeof searchIndexEnvSchema>;

export type SearchEntity = "TAREA" | "PROYECTO" | "MENSAJE" | "ARCHIVO";

export type SearchResultItem = {
  entity: SearchEntity;
  id: string;
  title: string;
  subtitle: string | null;
  path: string;
};

export type IndexedSearchGroups = {
  tasks: SearchResultItem[];
  projects: SearchResultItem[];
  messages: SearchResultItem[];
  files: SearchResultItem[];
};

export type SearchAccessContext = {
  userId: string;
  accessibleProjectIds: string[];
  accessibleTeamIds: string[];
  projectId: string | null;
};

export type SearchIndexLogger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export interface SearchIndex {
  readonly enabled: boolean;
  initialize(): Promise<void>;
  search(input: { query: string; access: SearchAccessContext }): Promise<IndexedSearchGroups>;
  reindexAll(): Promise<{ indexed: number }>;
  syncTask(taskId: string): Promise<void>;
  syncProject(projectId: string): Promise<void>;
  syncMessage(messageId: string): Promise<void>;
  syncFile(fileId: string): Promise<void>;
}

type SearchIndexDocument = {
  id: string;
  entity: SearchEntity;
  entityId: string;
  title: string;
  subtitle: string | null;
  path: string;
  content: string;
  accessProjectIds: string[];
  accessTeamIds: string[];
  accessUserIds: string[];
  updatedAt: number;
};

type SearchIndexTaskSummary = {
  taskUid?: number;
  uid?: number;
};

type SearchIndexTaskStatus = {
  status?: string;
  error?: {
    message?: string;
  };
};

type SearchResponsePayload = {
  hits?: SearchIndexDocument[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeBaseUrl = (value: string) => value.replace(/\/+$/g, "");

const createDocumentId = (entity: SearchEntity, entityId: string) => `${entity}:${entityId}`;

const chunk = <T>(items: T[], size: number): T[][] => {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
};

const asFullName = (input: { firstName: string; lastName: string }) =>
  `${input.firstName} ${input.lastName}`.trim();

const compactText = (...parts: Array<string | null | undefined>) =>
  parts
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ");

const truncateText = (value: string, max = 120) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1)}…`;
};

const quoteFilterValue = (value: string) => JSON.stringify(value);

const buildInFilter = (field: string, values: string[]) =>
  `${field} IN [${values.map((value) => quoteFilterValue(value)).join(", ")}]`;

export const resolveSearchIndexEnv = (source: NodeJS.ProcessEnv): SearchIndexEnv =>
  searchIndexEnvSchema.parse(source);

export const buildProjectSearchPath = (projectId: string) =>
  `/projects?projectId=${encodeURIComponent(projectId)}`;

export const buildMessageSearchPath = (input: {
  channelId: string;
  projectId: string | null;
  teamId: string | null;
}) => {
  const params = new URLSearchParams({
    channelId: input.channelId
  });

  if (input.projectId) {
    params.set("projectId", input.projectId);
  }

  if (input.teamId) {
    params.set("teamId", input.teamId);
  }

  return `/messaging?${params.toString()}`;
};

export const buildFileSearchPath = (input: { projectId: string | null; teamId: string | null }) => {
  const params = new URLSearchParams();

  if (input.projectId) {
    params.set("projectId", input.projectId);
  }

  if (input.teamId) {
    params.set("teamId", input.teamId);
  }

  const query = params.toString();
  return query ? `/files?${query}` : "/files";
};

export class MeiliSearchIndex implements SearchIndex {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly indexUid: string;
  private readonly bootstrapOnStart: boolean;
  private readyPromise: Promise<void> | null = null;
  private readonly configured: boolean;
  private bootstrapChecked = false;
  private retryAfterMs = 0;

  constructor(input: {
    prisma: PrismaClient;
    logger: SearchIndexLogger;
    env: SearchIndexEnv;
  }) {
    this.prisma = input.prisma;
    this.logger = input.logger;
    this.baseUrl = sanitizeBaseUrl(input.env.MEILISEARCH_URL);
    this.apiKey = input.env.MEILISEARCH_API_KEY.trim();
    this.indexUid = input.env.MEILISEARCH_INDEX.trim();
    this.bootstrapOnStart = input.env.MEILISEARCH_BOOTSTRAP_ON_START;
    this.configured = input.env.MEILISEARCH_ENABLED;
  }

  private readonly prisma: PrismaClient;
  private readonly logger: SearchIndexLogger;

  get enabled() {
    return this.configured;
  }

  async initialize() {
    await this.ensureReady(true);
  }

  async search(input: { query: string; access: SearchAccessContext }): Promise<IndexedSearchGroups> {
    if (!(await this.ensureReady(false))) {
      throw new Error("Meilisearch no disponible");
    }

    const [tasks, projects, messages, files] = await Promise.all([
      this.searchEntity("TAREA", input),
      this.searchEntity("PROYECTO", input),
      this.searchEntity("MENSAJE", input),
      this.searchEntity("ARCHIVO", input)
    ]);

    return {
      tasks,
      projects,
      messages,
      files
    };
  }

  async reindexAll() {
    if (!(await this.ensureReady(false))) {
      throw new Error("Meilisearch no disponible");
    }

    return this.reindexAllInternal();
  }

  private async reindexAllInternal() {
    await this.clearAllDocuments();

    let indexed = 0;
    indexed += await this.reindexTaskDocuments();
    indexed += await this.reindexProjectDocuments();
    indexed += await this.reindexMessageDocuments();
    indexed += await this.reindexFileDocuments();

    this.logger.info({ indexed, index: this.indexUid }, "Reindexado completo de búsqueda finalizado");

    return { indexed };
  }

  async syncTask(taskId: string) {
    await this.syncSingleDocument("TAREA", taskId, () => this.buildTaskDocument(taskId));
  }

  async syncProject(projectId: string) {
    await this.syncSingleDocument("PROYECTO", projectId, () => this.buildProjectDocument(projectId));
  }

  async syncMessage(messageId: string) {
    await this.syncSingleDocument("MENSAJE", messageId, () => this.buildMessageDocument(messageId));
  }

  async syncFile(fileId: string) {
    await this.syncSingleDocument("ARCHIVO", fileId, () => this.buildFileDocument(fileId));
  }

  private async ensureReady(allowBootstrap: boolean) {
    if (!this.configured) {
      return false;
    }

    if (Date.now() < this.retryAfterMs) {
      return false;
    }

    if (!this.readyPromise) {
      this.readyPromise = this.prepareIndex(allowBootstrap);
    }

    try {
      await this.readyPromise;
      this.retryAfterMs = 0;
      return true;
    } catch (error) {
      this.readyPromise = null;
      this.registerFailure(error);
      return false;
    }
  }

  private registerFailure(error: unknown) {
    this.retryAfterMs = Date.now() + 30_000;
    this.logger.warn(
      {
        index: this.indexUid,
        reason: error instanceof Error ? error.message : String(error)
      },
      "Meilisearch no disponible temporalmente; se usará fallback SQL y se reintentará luego"
    );
  }

  private async prepareIndex(allowBootstrap: boolean) {
    await this.createIndexIfMissing();
    await this.updateSettings();

    if (!allowBootstrap || !this.bootstrapOnStart || this.bootstrapChecked) {
      return;
    }

    this.bootstrapChecked = true;

    const documentCount = await this.getDocumentCount();
    if (documentCount > 0) {
      return;
    }

    this.logger.info(
      { index: this.indexUid },
      "Índice de búsqueda vacío; iniciando bootstrap automático con datos actuales"
    );

    await this.reindexAllInternal();
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);

    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers
    });
  }

  private async expectJson<T>(response: Response, context: string): Promise<T> {
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`${context} (${response.status}): ${raw || response.statusText}`);
    }

    return raw ? (JSON.parse(raw) as T) : ({} as T);
  }

  private extractTaskUid(payload: unknown) {
    const taskUid =
      typeof (payload as SearchIndexTaskSummary | null)?.taskUid === "number"
        ? (payload as SearchIndexTaskSummary).taskUid
        : typeof (payload as SearchIndexTaskSummary | null)?.uid === "number"
          ? (payload as SearchIndexTaskSummary).uid
          : null;

    return taskUid;
  }

  private async awaitTask(payload: unknown) {
    const taskUid = this.extractTaskUid(payload);
    if (taskUid === null) {
      return;
    }

    const start = Date.now();
    while (Date.now() - start < TASK_POLL_TIMEOUT_MS) {
      const response = await this.request(`/tasks/${taskUid}`);
      const task = await this.expectJson<SearchIndexTaskStatus>(
        response,
        `No se pudo verificar el task ${taskUid} de Meilisearch`
      );

      if (task.status === "succeeded") {
        return;
      }

      if (task.status === "failed" || task.status === "canceled") {
        throw new Error(task.error?.message ?? `Task ${taskUid} terminó con estado ${task.status}`);
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }

    throw new Error(`Tiempo de espera agotado para el task ${taskUid} de Meilisearch`);
  }

  private async createIndexIfMissing() {
    const existingResponse = await this.request(`/indexes/${encodeURIComponent(this.indexUid)}`);
    if (existingResponse.ok) {
      return;
    }

    if (existingResponse.status !== 404) {
      await this.expectJson<Record<string, unknown>>(
        existingResponse,
        `No se pudo consultar el índice ${this.indexUid}`
      );
      return;
    }

    const createResponse = await this.request("/indexes", {
      method: "POST",
      body: JSON.stringify({
        uid: this.indexUid,
        primaryKey: "id"
      })
    });
    const payload = await this.expectJson<Record<string, unknown>>(
      createResponse,
      `No se pudo crear el índice ${this.indexUid}`
    );
    await this.awaitTask(payload);
  }

  private async updateSettings() {
    const response = await this.request(`/indexes/${encodeURIComponent(this.indexUid)}/settings`, {
      method: "PATCH",
      body: JSON.stringify({
        searchableAttributes: ["title", "subtitle", "content"],
        filterableAttributes: ["entity", "accessProjectIds", "accessTeamIds", "accessUserIds"],
        sortableAttributes: ["updatedAt"],
        displayedAttributes: ["entity", "entityId", "title", "subtitle", "path", "updatedAt"]
      })
    });
    const payload = await this.expectJson<Record<string, unknown>>(
      response,
      `No se pudo actualizar la configuración del índice ${this.indexUid}`
    );
    await this.awaitTask(payload);
  }

  private async getDocumentCount() {
    const response = await this.request(`/indexes/${encodeURIComponent(this.indexUid)}/stats`);
    const payload = await this.expectJson<{ numberOfDocuments?: number }>(
      response,
      `No se pudieron obtener estadísticas del índice ${this.indexUid}`
    );

    return payload.numberOfDocuments ?? 0;
  }

  private async upsertDocuments(documents: SearchIndexDocument[]) {
    if (documents.length === 0) {
      return;
    }

    for (const batch of chunk(documents, SEARCH_BATCH_SIZE)) {
      const response = await this.request(`/indexes/${encodeURIComponent(this.indexUid)}/documents`, {
        method: "POST",
        body: JSON.stringify(batch)
      });
      const payload = await this.expectJson<Record<string, unknown>>(
        response,
        `No se pudieron actualizar ${batch.length} documentos de búsqueda`
      );
      await this.awaitTask(payload);
    }
  }

  private async deleteDocument(documentId: string) {
    const response = await this.request(
      `/indexes/${encodeURIComponent(this.indexUid)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE"
      }
    );

    if (response.status === 404) {
      return;
    }

    const payload = await this.expectJson<Record<string, unknown>>(
      response,
      `No se pudo eliminar el documento ${documentId} del índice`
    );
    await this.awaitTask(payload);
  }

  private async clearAllDocuments() {
    const response = await this.request(`/indexes/${encodeURIComponent(this.indexUid)}/documents`, {
      method: "DELETE"
    });
    const payload = await this.expectJson<Record<string, unknown>>(
      response,
      `No se pudo limpiar el índice ${this.indexUid}`
    );
    await this.awaitTask(payload);
  }

  private async syncSingleDocument(
    entity: SearchEntity,
    entityId: string,
    loader: () => Promise<SearchIndexDocument | null>
  ) {
    if (!(await this.ensureReady(false))) {
      return;
    }

    try {
      const document = await loader();
      if (!document) {
        await this.deleteDocument(createDocumentId(entity, entityId));
        return;
      }

      await this.upsertDocuments([document]);
    } catch (error) {
      this.readyPromise = null;
      this.registerFailure(error);
    }
  }

  private async searchEntity(
    entity: SearchEntity,
    input: { query: string; access: SearchAccessContext }
  ): Promise<SearchResultItem[]> {
    const filter = this.buildFilter(entity, input.access);
    if (!filter) {
      return [];
    }

    const response = await this.request(`/indexes/${encodeURIComponent(this.indexUid)}/search`, {
      method: "POST",
      body: JSON.stringify({
        q: input.query,
        limit: SEARCH_RESULT_LIMIT,
        filter
      })
    });
    const payload = await this.expectJson<SearchResponsePayload>(
      response,
      `No se pudo ejecutar la búsqueda ${entity}`
    );

    return (payload.hits ?? []).map((item) => ({
      entity: item.entity,
      id: item.entityId,
      title: item.title,
      subtitle: item.subtitle,
      path: item.path
    }));
  }

  private buildFilter(entity: SearchEntity, access: SearchAccessContext) {
    if (access.projectId) {
      return `entity = ${quoteFilterValue(entity)} AND ${buildInFilter("accessProjectIds", [access.projectId])}`;
    }

    const clauses: string[] = [];

    if ((entity === "TAREA" || entity === "PROYECTO" || entity === "MENSAJE" || entity === "ARCHIVO") && access.accessibleProjectIds.length > 0) {
      clauses.push(buildInFilter("accessProjectIds", access.accessibleProjectIds));
    }

    if (entity === "ARCHIVO" && access.accessibleTeamIds.length > 0) {
      clauses.push(buildInFilter("accessTeamIds", access.accessibleTeamIds));
    }

    if (entity === "MENSAJE") {
      clauses.push(buildInFilter("accessUserIds", [access.userId]));
    }

    if (clauses.length === 0) {
      return null;
    }

    return `entity = ${quoteFilterValue(entity)} AND (${clauses.join(" OR ")})`;
  }

  private async reindexTaskDocuments() {
    let indexed = 0;
    let cursor: string | undefined;

    while (true) {
      const rows = await this.prisma.task.findMany({
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1
            }
          : {}),
        take: SEARCH_BATCH_SIZE,
        orderBy: { id: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
          project: {
            select: {
              name: true
            }
          },
          assignee: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          createdBy: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (rows.length === 0) {
        break;
      }

      const documents = rows.map((task) =>
        this.mapTaskDocument({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          projectId: task.projectId,
          projectName: task.project.name,
          assigneeName: task.assignee ? asFullName(task.assignee) : null,
          createdByName: asFullName(task.createdBy),
          updatedAt: task.updatedAt
        })
      );

      await this.upsertDocuments(documents);
      indexed += documents.length;
      cursor = rows[rows.length - 1]?.id;
    }

    return indexed;
  }

  private async reindexProjectDocuments() {
    let indexed = 0;
    let cursor: string | undefined;

    while (true) {
      const rows = await this.prisma.project.findMany({
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1
            }
          : {}),
        take: SEARCH_BATCH_SIZE,
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          template: true,
          createdAt: true,
          updatedAt: true,
          owner: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (rows.length === 0) {
        break;
      }

      const documents = rows.map((project) =>
        this.mapProjectDocument({
          id: project.id,
          name: project.name,
          description: project.description,
          template: project.template,
          ownerName: asFullName(project.owner),
          updatedAt: project.updatedAt
        })
      );

      await this.upsertDocuments(documents);
      indexed += documents.length;
      cursor = rows[rows.length - 1]?.id;
    }

    return indexed;
  }

  private async reindexMessageDocuments() {
    let indexed = 0;
    let cursor: string | undefined;

    while (true) {
      const rows = await this.prisma.message.findMany({
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1
            }
          : {}),
        take: SEARCH_BATCH_SIZE,
        orderBy: { id: "asc" },
        select: {
          id: true,
          kind: true,
          content: true,
          updatedAt: true,
          attachments: {
            select: {
              originalName: true
            }
          },
          author: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          channel: {
            select: {
              id: true,
              name: true,
              projectId: true,
              teamId: true,
              members: {
                select: {
                  userId: true
                }
              }
            }
          }
        }
      });

      if (rows.length === 0) {
        break;
      }

      const documents = rows.map((message) =>
        this.mapMessageDocument({
          id: message.id,
          kind: message.kind,
          content: message.content,
          attachmentNames: message.attachments.map((attachment) => attachment.originalName),
          authorName: asFullName(message.author),
          channelId: message.channel.id,
          channelName: message.channel.name,
          projectId: message.channel.projectId,
          teamId: message.channel.teamId,
          memberIds: message.channel.members.map((member) => member.userId),
          updatedAt: message.updatedAt
        })
      );

      await this.upsertDocuments(documents);
      indexed += documents.length;
      cursor = rows[rows.length - 1]?.id;
    }

    return indexed;
  }

  private async reindexFileDocuments() {
    let indexed = 0;
    let cursor: string | undefined;

    while (true) {
      const rows = await this.prisma.fileObject.findMany({
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1
            }
          : {}),
        take: SEARCH_BATCH_SIZE,
        orderBy: { id: "asc" },
        where: {
          deletedAt: null
        },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          createdAt: true,
          folder: {
            select: {
              projectId: true,
              teamId: true,
              project: {
                select: {
                  name: true
                }
              },
              team: {
                select: {
                  name: true
                }
              }
            }
          },
          owner: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (rows.length === 0) {
        break;
      }

      const documents = rows.map((file) =>
        this.mapFileDocument({
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          projectId: file.folder.projectId,
          projectName: file.folder.project?.name ?? null,
          teamId: file.folder.teamId,
          teamName: file.folder.team?.name ?? null,
          ownerName: asFullName(file.owner),
          createdAt: file.createdAt
        })
      );

      await this.upsertDocuments(documents);
      indexed += documents.length;
      cursor = rows[rows.length - 1]?.id;
    }

    return indexed;
  }

  private mapTaskDocument(input: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    projectId: string;
    projectName: string;
    assigneeName: string | null;
    createdByName: string;
    updatedAt: Date;
  }): SearchIndexDocument {
    return {
      id: createDocumentId("TAREA", input.id),
      entity: "TAREA",
      entityId: input.id,
      title: input.title,
      subtitle: `${input.status} · ${input.projectName}`,
      path: `/tasks/${encodeURIComponent(input.id)}`,
      content: compactText(
        input.title,
        input.description,
        input.projectName,
        input.assigneeName,
        input.createdByName
      ),
      accessProjectIds: [input.projectId],
      accessTeamIds: [],
      accessUserIds: [],
      updatedAt: input.updatedAt.getTime()
    };
  }

  private mapProjectDocument(input: {
    id: string;
    name: string;
    description: string | null;
    template: string;
    ownerName: string;
    updatedAt: Date;
  }): SearchIndexDocument {
    return {
      id: createDocumentId("PROYECTO", input.id),
      entity: "PROYECTO",
      entityId: input.id,
      title: input.name,
      subtitle: input.template,
      path: buildProjectSearchPath(input.id),
      content: compactText(input.name, input.description, input.template, input.ownerName),
      accessProjectIds: [input.id],
      accessTeamIds: [],
      accessUserIds: [],
      updatedAt: input.updatedAt.getTime()
    };
  }

  private mapMessageDocument(input: {
    id: string;
    kind: string;
    content: string;
    attachmentNames: string[];
    authorName: string;
    channelId: string;
    channelName: string;
    projectId: string | null;
    teamId: string | null;
    memberIds: string[];
    updatedAt: Date;
  }): SearchIndexDocument {
    const attachmentNames = input.attachmentNames.join(" ");
    const title =
      input.kind === "FILE" && input.attachmentNames.length > 0
        ? `Archivo compartido: ${input.attachmentNames[0]}`
        : input.kind === "CALL_INVITE"
          ? "Videollamada instantánea iniciada"
          : truncateText(input.content, 100);

    return {
      id: createDocumentId("MENSAJE", input.id),
      entity: "MENSAJE",
      entityId: input.id,
      title,
      subtitle: input.channelName,
      path: buildMessageSearchPath({
        channelId: input.channelId,
        projectId: input.projectId,
        teamId: input.teamId
      }),
      content: compactText(input.content, attachmentNames, input.channelName, input.authorName),
      accessProjectIds: input.projectId ? [input.projectId] : [],
      accessTeamIds: [],
      accessUserIds: input.projectId ? [] : input.memberIds,
      updatedAt: input.updatedAt.getTime()
    };
  }

  private mapFileDocument(input: {
    id: string;
    originalName: string;
    mimeType: string;
    projectId: string | null;
    projectName: string | null;
    teamId: string | null;
    teamName: string | null;
    ownerName: string;
    createdAt: Date;
  }): SearchIndexDocument {
    return {
      id: createDocumentId("ARCHIVO", input.id),
      entity: "ARCHIVO",
      entityId: input.id,
      title: input.originalName,
      subtitle: input.mimeType,
      path: buildFileSearchPath({
        projectId: input.projectId,
        teamId: input.teamId
      }),
      content: compactText(
        input.originalName,
        input.mimeType,
        input.projectName,
        input.teamName,
        input.ownerName
      ),
      accessProjectIds: input.projectId ? [input.projectId] : [],
      accessTeamIds: input.teamId ? [input.teamId] : [],
      accessUserIds: [],
      updatedAt: input.createdAt.getTime()
    };
  }

  private async buildTaskDocument(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        projectId: true,
        updatedAt: true,
        project: {
          select: {
            name: true
          }
        },
        assignee: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!task) {
      return null;
    }

    return this.mapTaskDocument({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      projectId: task.projectId,
      projectName: task.project.name,
      assigneeName: task.assignee ? asFullName(task.assignee) : null,
      createdByName: asFullName(task.createdBy),
      updatedAt: task.updatedAt
    });
  }

  private async buildProjectDocument(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        template: true,
        updatedAt: true,
        owner: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!project) {
      return null;
    }

    return this.mapProjectDocument({
      id: project.id,
      name: project.name,
      description: project.description,
      template: project.template,
      ownerName: asFullName(project.owner),
      updatedAt: project.updatedAt
    });
  }

  private async buildMessageDocument(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        kind: true,
        content: true,
        updatedAt: true,
        attachments: {
          select: {
            originalName: true
          }
        },
        author: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        channel: {
          select: {
            id: true,
            name: true,
            projectId: true,
            teamId: true,
            members: {
              select: {
                userId: true
              }
            }
          }
        }
      }
    });

    if (!message) {
      return null;
    }

    return this.mapMessageDocument({
      id: message.id,
      kind: message.kind,
      content: message.content,
      attachmentNames: message.attachments.map((attachment) => attachment.originalName),
      authorName: asFullName(message.author),
      channelId: message.channel.id,
      channelName: message.channel.name,
      projectId: message.channel.projectId,
      teamId: message.channel.teamId,
      memberIds: message.channel.members.map((member) => member.userId),
      updatedAt: message.updatedAt
    });
  }

  private async buildFileDocument(fileId: string) {
    const file = await this.prisma.fileObject.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        createdAt: true,
        deletedAt: true,
        folder: {
          select: {
            projectId: true,
            teamId: true,
            project: {
              select: {
                name: true
              }
            },
            team: {
              select: {
                name: true
              }
            }
          }
        },
        owner: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!file || file.deletedAt) {
      return null;
    }

    return this.mapFileDocument({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      projectId: file.folder.projectId,
      projectName: file.folder.project?.name ?? null,
      teamId: file.folder.teamId,
      teamName: file.folder.team?.name ?? null,
      ownerName: asFullName(file.owner),
      createdAt: file.createdAt
    });
  }
}
