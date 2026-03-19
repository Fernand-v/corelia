import { Prisma } from "@prisma/client";
import type { DynamicFormQuestionType, RoleCode } from "@corelia/types";
import type { FastifyInstance } from "fastify";
import { attachTraceContext } from "../../lib/tracing.js";

const formManagerRoles = new Set<RoleCode>([
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO"
]);

type DynamicFormListQuery = {
  projectId?: string;
  includeInactive?: boolean;
  createdByMe?: boolean;
};

type DynamicFormQuestionInput = {
  type: DynamicFormQuestionType;
  label: string;
  required?: boolean;
  options?: string[];
  order?: number;
};

export class FormService {
  constructor(private readonly app: FastifyInstance) {}

  private forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
  }

  private async getActorRole(actorId: string): Promise<RoleCode> {
    const actor = await this.app.prisma.user.findUnique({
      where: { id: actorId },
      select: {
        baseRole: {
          select: {
            key: true
          }
        }
      }
    });

    const role = actor?.baseRole?.key as RoleCode | undefined;
    if (!role) {
      throw new Error("Usuario no encontrado");
    }

    return role;
  }

  private normalizeOptions(options?: string[]): string[] | null {
    if (!options || options.length === 0) {
      return null;
    }

    const normalized = Array.from(
      new Set(options.map((option) => option.trim()).filter((option) => option.length > 0))
    );

    return normalized.length > 0 ? normalized : null;
  }

  private parseOptions(options: Prisma.JsonValue | null): string[] | null {
    if (!Array.isArray(options)) {
      return null;
    }

    const parsed = options
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return parsed.length > 0 ? parsed : null;
  }

  private toInputJson(value: Prisma.JsonValue) {
    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private mapDynamicForm(
    form: {
      id: string;
      title: string;
      description: string | null;
      createdById: string;
      projectId: string | null;
      isActive: boolean;
      allowMultipleSubmissions: boolean;
      isAnonymous: boolean;
      createdAt: Date;
      updatedAt: Date;
      createdBy?: { id: string; firstName: string; lastName: string } | null;
      project?: { id: string; name: string } | null;
      _count?: { questions?: number; responses?: number };
      responses?: Array<{ id: string }>;
    }
  ) {
    return {
      id: form.id,
      title: form.title,
      description: form.description,
      createdById: form.createdById,
      projectId: form.projectId,
      isActive: form.isActive,
      allowMultipleSubmissions: form.allowMultipleSubmissions,
      isAnonymous: form.isAnonymous,
      createdAt: form.createdAt.toISOString(),
      updatedAt: form.updatedAt.toISOString(),
      createdBy: form.createdBy
        ? {
            id: form.createdBy.id,
            fullName: `${form.createdBy.firstName} ${form.createdBy.lastName}`.trim()
          }
        : null,
      project: form.project
        ? {
            id: form.project.id,
            name: form.project.name
          }
        : null,
      questionCount: form._count?.questions ?? 0,
      responseCount: form._count?.responses ?? 0,
      submittedByMe: form.responses ? form.responses.length > 0 : false
    };
  }

  private mapDynamicQuestion(question: {
    id: string;
    formId: string;
    type: DynamicFormQuestionType;
    label: string;
    required: boolean;
    options: Prisma.JsonValue | null;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: question.id,
      formId: question.formId,
      type: question.type,
      label: question.label,
      required: question.required,
      options: this.parseOptions(question.options),
      order: question.order,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString()
    };
  }

  private async ensureProjectAccess(actorId: string, actorRole: RoleCode, projectId: string) {
    const project = await this.app.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        members: {
          where: { userId: actorId },
          select: { id: true },
          take: 1
        }
      }
    });

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    if (actorRole === "ADMINISTRADOR") {
      return project;
    }

    const isMember = project.ownerId === actorId || project.members.length > 0;
    if (!isMember) {
      throw this.forbidden("No tienes acceso a este proyecto");
    }

    return project;
  }

  private async ensureCanManageForm(actorId: string, actorRole: RoleCode, form: { createdById: string; projectId: string | null }) {
    if (!formManagerRoles.has(actorRole)) {
      throw this.forbidden("No tienes permisos para gestionar formularios");
    }

    if (actorRole === "ADMINISTRADOR") {
      return;
    }

    if (form.createdById !== actorId) {
      throw this.forbidden("Solo puedes gestionar formularios creados por ti");
    }

    if (form.projectId) {
      await this.ensureProjectAccess(actorId, actorRole, form.projectId);
    }
  }

  private async ensureCanReadForm(actorId: string, actorRole: RoleCode, form: {
    id: string;
    createdById: string;
    projectId: string | null;
    isActive: boolean;
  }) {
    if (form.projectId) {
      await this.ensureProjectAccess(actorId, actorRole, form.projectId);
    }

    if (form.isActive) {
      return;
    }

    if (actorRole === "ADMINISTRADOR") {
      return;
    }

    if (form.createdById === actorId && formManagerRoles.has(actorRole)) {
      return;
    }

    throw this.forbidden("El formulario no está publicado");
  }

  private normalizeAnswerValue(
    question: {
      type: DynamicFormQuestionType;
      label: string;
      required: boolean;
      options: Prisma.JsonValue | null;
    },
    rawValue: unknown
  ): Prisma.JsonValue {
    const options = this.parseOptions(question.options) ?? [];

    switch (question.type) {
      case "short_text": {
        if (typeof rawValue !== "string") {
          throw new Error(`La respuesta para "${question.label}" debe ser texto`);
        }
        const value = rawValue.trim();
        if (question.required && value.length === 0) {
          throw new Error(`La pregunta "${question.label}" es obligatoria`);
        }
        if (value.length > 500) {
          throw new Error(`La respuesta para "${question.label}" excede el máximo de 500 caracteres`);
        }
        return value;
      }
      case "long_text": {
        if (typeof rawValue !== "string") {
          throw new Error(`La respuesta para "${question.label}" debe ser texto`);
        }
        const value = rawValue.trim();
        if (question.required && value.length === 0) {
          throw new Error(`La pregunta "${question.label}" es obligatoria`);
        }
        if (value.length > 5000) {
          throw new Error(`La respuesta para "${question.label}" excede el máximo de 5000 caracteres`);
        }
        return value;
      }
      case "multiple_choice": {
        if (typeof rawValue !== "string") {
          throw new Error(`La respuesta para "${question.label}" debe ser una opción`);
        }
        const value = rawValue.trim();
        if (question.required && value.length === 0) {
          throw new Error(`La pregunta "${question.label}" es obligatoria`);
        }
        if (value && !options.includes(value)) {
          throw new Error(`La opción seleccionada en "${question.label}" no es válida`);
        }
        return value;
      }
      case "checkbox": {
        if (!Array.isArray(rawValue)) {
          throw new Error(`La respuesta para "${question.label}" debe ser una lista de opciones`);
        }
        const values = Array.from(
          new Set(
            rawValue
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
          )
        );

        const invalid = values.find((item) => !options.includes(item));
        if (invalid) {
          throw new Error(`La opción "${invalid}" no es válida en "${question.label}"`);
        }

        if (question.required && values.length === 0) {
          throw new Error(`La pregunta "${question.label}" es obligatoria`);
        }

        return values;
      }
      case "rating": {
        const numeric =
          typeof rawValue === "number"
            ? rawValue
            : typeof rawValue === "string"
              ? Number(rawValue)
              : Number.NaN;

        if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
          throw new Error(`La valoración de "${question.label}" debe estar entre 1 y 5`);
        }

        return numeric;
      }
      case "date": {
        if (typeof rawValue !== "string") {
          throw new Error(`La respuesta para "${question.label}" debe ser una fecha`);
        }

        const value = rawValue.trim();
        if (question.required && value.length === 0) {
          throw new Error(`La pregunta "${question.label}" es obligatoria`);
        }

        if (value.length > 0) {
          const parsedDate = new Date(value);
          if (Number.isNaN(parsedDate.valueOf())) {
            throw new Error(`La fecha ingresada en "${question.label}" no es válida`);
          }
        }

        return value;
      }
      default:
        return rawValue as Prisma.JsonValue;
    }
  }

  private async enqueueNotification(notificationId: string) {
    if (!this.app.queues) {
      return;
    }

    await this.app.queues.notifications.add(
      "send-notification",
      attachTraceContext({
        notificationId
      })
    );
  }

  private async enqueueWebhooks(
    event:
      | "TAREA_COMPLETADA"
      | "SOLICITUD_APROBADA"
      | "SOLICITUD_RECHAZADA"
      | "TAREA_REASIGNADA"
      | "TAREA_VENCIDA",
    payload: Record<string, unknown>
  ) {
    if (!this.app.queues) {
      return;
    }

    const endpoints = await this.app.prisma.webhookEndpoint.findMany({
      where: {
        event,
        enabled: true
      },
      select: { id: true }
    });

    await Promise.all(
      endpoints.map((endpoint) =>
        this.app.queues!.webhooks.add(
          "deliver-webhook",
          attachTraceContext({
            endpointId: endpoint.id,
            payload
          })
        )
      )
    );
  }

  async create(input: {
    requesterId: string;
    type: "VACACIONES" | "PERMISO" | "ACCESO_RECURSO";
    payload: Record<string, unknown>;
  }) {
    const serialized = JSON.stringify(input.payload);
    if (serialized.length > 10_000) {
      throw new Error("El payload de la solicitud excede el tamaño máximo permitido (10KB)");
    }

    return this.app.prisma.formRequest.create({
      data: {
        requesterId: input.requesterId,
        type: input.type,
        payload: serialized
      }
    });
  }

  async resolve(input: {
    requestId: string;
    status: "APROBADA" | "RECHAZADA";
    comment: string;
    approverId: string;
  }) {
    const resolved = await this.app.prisma.formRequest.update({
      where: { id: input.requestId },
      data: {
        status: input.status,
        comment: input.comment,
        approverId: input.approverId
      }
    });

    const notification = await this.app.prisma.notification.create({
      data: {
        userId: resolved.requesterId,
        event: "SOLICITUD_RESUELTA",
        channel: "IN_APP",
        title: `Solicitud ${resolved.status.toLowerCase()}`,
        body: `Tu solicitud ${resolved.id} fue ${resolved.status.toLowerCase()}`
      }
    });

    await this.enqueueNotification(notification.id);

    await this.enqueueWebhooks(
      resolved.status === "APROBADA" ? "SOLICITUD_APROBADA" : "SOLICITUD_RECHAZADA",
      {
        requestId: resolved.id,
        status: resolved.status,
        approverId: resolved.approverId
      }
    );

    let payload: Record<string, unknown> = {};
    if (typeof resolved.payload === "string") {
      try {
        payload = JSON.parse(resolved.payload) as Record<string, unknown>;
      } catch {
        payload = {};
      }
    }
    const projectId = typeof payload.projectId === "string" ? payload.projectId : undefined;
    if (projectId && this.app.queues) {
      await this.app.queues.automations.add(
        "apply-automation",
        attachTraceContext({
          projectId,
          event: "SOLICITUD_RESUELTA",
          context: {
            requestId: resolved.id,
            status: resolved.status,
            requesterId: resolved.requesterId,
            approverId: resolved.approverId
          }
        })
      );
    }

    return resolved;
  }

  async listForUser(userId: string) {
    return this.app.prisma.formRequest.findMany({
      where: {
        OR: [{ requesterId: userId }, { approverId: userId }]
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createDynamicForm(
    actorId: string,
    input: {
      title: string;
      description?: string | null;
      projectId?: string | null;
      isActive?: boolean;
      allowMultipleSubmissions?: boolean;
      isAnonymous?: boolean;
    }
  ) {
    const actorRole = await this.getActorRole(actorId);

    if (!formManagerRoles.has(actorRole)) {
      throw this.forbidden("Solo administradores, líderes o coordinadores pueden crear formularios");
    }

    if (input.projectId) {
      await this.ensureProjectAccess(actorId, actorRole, input.projectId);
    }

    const created = await this.app.prisma.dynamicForm.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        createdById: actorId,
        projectId: input.projectId ?? null,
        isActive: input.isActive ?? false,
        allowMultipleSubmissions: input.allowMultipleSubmissions ?? false,
        isAnonymous: input.isAnonymous ?? false
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            questions: true,
            responses: true
          }
        }
      }
    });

    return this.mapDynamicForm(created);
  }

  async updateDynamicForm(
    actorId: string,
    formId: string,
    input: {
      title?: string;
      description?: string | null;
      projectId?: string | null;
      isActive?: boolean;
      allowMultipleSubmissions?: boolean;
      isAnonymous?: boolean;
    }
  ) {
    const actorRole = await this.getActorRole(actorId);

    const existing = await this.app.prisma.dynamicForm.findUnique({
      where: { id: formId },
      select: {
        id: true,
        createdById: true,
        projectId: true
      }
    });

    if (!existing) {
      throw new Error("Formulario no encontrado");
    }

    await this.ensureCanManageForm(actorId, actorRole, existing);

    if (input.projectId) {
      await this.ensureProjectAccess(actorId, actorRole, input.projectId);
    }

    const updated = await this.app.prisma.dynamicForm.update({
      where: { id: formId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.allowMultipleSubmissions !== undefined
          ? { allowMultipleSubmissions: input.allowMultipleSubmissions }
          : {}),
        ...(input.isAnonymous !== undefined ? { isAnonymous: input.isAnonymous } : {})
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            questions: true,
            responses: true
          }
        }
      }
    });

    return this.mapDynamicForm(updated);
  }

  async listDynamicForms(actorId: string, query: DynamicFormListQuery) {
    const actorRole = await this.getActorRole(actorId);
    const isManager = formManagerRoles.has(actorRole);
    const includeInactive = query.includeInactive ?? false;

    if (query.projectId) {
      await this.ensureProjectAccess(actorId, actorRole, query.projectId);
    }

    const where: Prisma.DynamicFormWhereInput = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.createdByMe ? { createdById: actorId } : {})
    };

    if (actorRole !== "ADMINISTRADOR") {
      where.OR = [
        {
          projectId: null
        },
        {
          project: {
            OR: [
              { ownerId: actorId },
              {
                members: {
                  some: {
                    userId: actorId
                  }
                }
              }
            ]
          }
        }
      ];
    }

    if (!isManager) {
      where.isActive = true;
    } else if (!includeInactive) {
      const currentAnd = where.AND;
      const andClauses: Prisma.DynamicFormWhereInput[] = [];

      if (Array.isArray(currentAnd)) {
        andClauses.push(...currentAnd);
      } else if (currentAnd) {
        andClauses.push(currentAnd);
      }

      andClauses.push({ OR: [{ isActive: true }, { createdById: actorId }] });
      where.AND = andClauses;
    }

    const forms = await this.app.prisma.dynamicForm.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            questions: true,
            responses: true
          }
        },
        responses: {
          where: {
            userId: actorId
          },
          select: {
            id: true
          },
          take: 1
        }
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
    });

    return forms.map((form) => this.mapDynamicForm(form));
  }

  async getDynamicFormById(actorId: string, formId: string) {
    const actorRole = await this.getActorRole(actorId);

    const form = await this.app.prisma.dynamicForm.findUnique({
      where: { id: formId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        questions: {
          orderBy: {
            order: "asc"
          }
        },
        _count: {
          select: {
            responses: true
          }
        }
      }
    });

    if (!form) {
      throw new Error("Formulario no encontrado");
    }

    await this.ensureCanReadForm(actorId, actorRole, form);

    const submitted = await this.app.prisma.dynamicFormResponse.findFirst({
      where: {
        formId,
        userId: actorId
      },
      select: {
        id: true
      }
    });

    return {
      ...this.mapDynamicForm(form),
      questions: form.questions.map((question) => this.mapDynamicQuestion(question)),
      totalResponses: form._count.responses,
      submittedByMe: Boolean(submitted)
    };
  }

  async addDynamicQuestion(actorId: string, formId: string, input: DynamicFormQuestionInput) {
    const actorRole = await this.getActorRole(actorId);

    const form = await this.app.prisma.dynamicForm.findUnique({
      where: { id: formId },
      select: {
        id: true,
        createdById: true,
        projectId: true
      }
    });

    if (!form) {
      throw new Error("Formulario no encontrado");
    }

    await this.ensureCanManageForm(actorId, actorRole, form);

    const options = this.normalizeOptions(input.options);
    const requiresOptions = input.type === "multiple_choice" || input.type === "checkbox";

    if (requiresOptions && (!options || options.length < 2)) {
      throw new Error("Las preguntas de opción requieren al menos 2 opciones");
    }

    if (!requiresOptions && options) {
      throw new Error("Este tipo de pregunta no admite opciones");
    }

    let order = input.order;
    if (order === undefined) {
      const lastQuestion = await this.app.prisma.dynamicFormQuestion.findFirst({
        where: { formId },
        orderBy: {
          order: "desc"
        },
        select: {
          order: true
        }
      });
      order = lastQuestion ? lastQuestion.order + 1 : 0;
    } else {
      const existingOrder = await this.app.prisma.dynamicFormQuestion.findFirst({
        where: {
          formId,
          order
        },
        select: { id: true }
      });

      if (existingOrder) {
        throw new Error("Ya existe una pregunta en ese orden");
      }
    }

    const created = await this.app.prisma.dynamicFormQuestion.create({
      data: {
        formId,
        type: input.type,
        label: input.label.trim(),
        required: input.required ?? false,
        ...(options ? { options } : {}),
        order
      }
    });

    return this.mapDynamicQuestion(created);
  }

  async updateDynamicQuestion(
    actorId: string,
    questionId: string,
    input: {
      type?: DynamicFormQuestionType;
      label?: string;
      required?: boolean;
      options?: string[];
      order?: number;
    }
  ) {
    const actorRole = await this.getActorRole(actorId);

    const existing = await this.app.prisma.dynamicFormQuestion.findUnique({
      where: { id: questionId },
      include: {
        form: {
          select: {
            id: true,
            createdById: true,
            projectId: true
          }
        }
      }
    });

    if (!existing) {
      throw new Error("Pregunta no encontrada");
    }

    await this.ensureCanManageForm(actorId, actorRole, existing.form);

    const nextType = input.type ?? existing.type;
    const nextOptions =
      input.options !== undefined
        ? this.normalizeOptions(input.options)
        : this.parseOptions(existing.options);

    const requiresOptions = nextType === "multiple_choice" || nextType === "checkbox";

    if (requiresOptions && (!nextOptions || nextOptions.length < 2)) {
      throw new Error("Las preguntas de opción requieren al menos 2 opciones");
    }

    if (!requiresOptions && nextOptions) {
      throw new Error("Este tipo de pregunta no admite opciones");
    }

    if (input.order !== undefined && input.order !== existing.order) {
      const occupied = await this.app.prisma.dynamicFormQuestion.findFirst({
        where: {
          formId: existing.formId,
          order: input.order,
          id: {
            not: questionId
          }
        },
        select: { id: true }
      });

      if (occupied) {
        throw new Error("Ya existe una pregunta en ese orden");
      }
    }

    const updated = await this.app.prisma.dynamicFormQuestion.update({
      where: { id: questionId },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.required !== undefined ? { required: input.required } : {}),
        ...(input.options !== undefined ? { options: nextOptions ?? Prisma.JsonNull } : {}),
        ...(input.order !== undefined ? { order: input.order } : {})
      }
    });

    return this.mapDynamicQuestion(updated);
  }

  async deleteDynamicForm(actorId: string, formId: string) {
    const actorRole = await this.getActorRole(actorId);

    const form = await this.app.prisma.dynamicForm.findUnique({
      where: { id: formId },
      select: {
        id: true,
        createdById: true,
        projectId: true,
        _count: {
          select: {
            responses: true
          }
        }
      }
    });

    if (!form) {
      throw new Error("Formulario no encontrado");
    }

    await this.ensureCanManageForm(actorId, actorRole, form);

    if (form._count.responses > 0) {
      throw new Error("No se puede eliminar un formulario que ya tiene respuestas. Usa la opción de ocultar en su lugar.");
    }

    await this.app.prisma.$transaction([
      this.app.prisma.dynamicFormQuestion.deleteMany({
        where: { formId }
      }),
      this.app.prisma.dynamicForm.delete({
        where: { id: formId }
      })
    ]);

    return { deleted: true };
  }

  async removeDynamicQuestion(actorId: string, questionId: string) {
    const actorRole = await this.getActorRole(actorId);

    const existing = await this.app.prisma.dynamicFormQuestion.findUnique({
      where: { id: questionId },
      include: {
        form: {
          select: {
            id: true,
            createdById: true,
            projectId: true
          }
        }
      }
    });

    if (!existing) {
      throw new Error("Pregunta no encontrada");
    }

    await this.ensureCanManageForm(actorId, actorRole, existing.form);

    await this.app.prisma.$transaction([
      this.app.prisma.dynamicFormQuestion.delete({
        where: { id: questionId }
      }),
      this.app.prisma.dynamicFormQuestion.updateMany({
        where: {
          formId: existing.formId,
          order: {
            gt: existing.order
          }
        },
        data: {
          order: {
            decrement: 1
          }
        }
      })
    ]);

    return {
      deleted: true
    };
  }

  async submitDynamicForm(
    actorId: string,
    formId: string,
    input: {
      answers: Array<{ questionId: string; value: unknown }>;
    }
  ) {
    const actorRole = await this.getActorRole(actorId);

    const form = await this.app.prisma.dynamicForm.findUnique({
      where: { id: formId },
      include: {
        questions: {
          orderBy: {
            order: "asc"
          }
        }
      }
    });

    if (!form) {
      throw new Error("Formulario no encontrado");
    }

    await this.ensureCanReadForm(actorId, actorRole, form);

    if (!form.isActive) {
      throw new Error("El formulario todavía no está publicado");
    }

    if (!form.allowMultipleSubmissions) {
      const existing = await this.app.prisma.dynamicFormResponse.findFirst({
        where: {
          formId,
          userId: actorId
        },
        select: {
          id: true
        }
      });

      if (existing) {
        throw new Error("Ya enviaste respuestas para este formulario");
      }
    }

    const answersByQuestion = new Map<string, unknown>();
    for (const answer of input.answers) {
      if (answersByQuestion.has(answer.questionId)) {
        throw new Error("No se permiten respuestas duplicadas para la misma pregunta");
      }
      answersByQuestion.set(answer.questionId, answer.value);
    }

    const unknownQuestion = input.answers.find(
      (answer) => !form.questions.some((question) => question.id === answer.questionId)
    );

    if (unknownQuestion) {
      throw new Error("Se enviaron respuestas para preguntas que no pertenecen al formulario");
    }

    const answerRows: Array<{ questionId: string; value: Prisma.JsonValue }> = [];

    for (const question of form.questions) {
      const hasAnswer = answersByQuestion.has(question.id);
      if (!hasAnswer) {
        if (question.required) {
          throw new Error(`La pregunta "${question.label}" es obligatoria`);
        }
        continue;
      }

      const rawValue = answersByQuestion.get(question.id);
      const normalizedValue = this.normalizeAnswerValue(
        {
          type: question.type,
          label: question.label,
          required: question.required,
          options: question.options
        },
        rawValue
      );

      answerRows.push({
        questionId: question.id,
        value: normalizedValue
      });
    }

    const { created, savedAnswers } = await this.app.prisma.$transaction(async (tx) => {
      const createdResponse = await tx.dynamicFormResponse.create({
        data: {
          formId,
          userId: actorId
        }
      });

      if (answerRows.length > 0) {
        await tx.dynamicFormAnswer.createMany({
          data: answerRows.map((answer) => ({
            responseId: createdResponse.id,
            questionId: answer.questionId,
            value: this.toInputJson(answer.value)
          }))
        });
      }

      const answers = await tx.dynamicFormAnswer.findMany({
        where: {
          responseId: createdResponse.id
        }
      });

      return {
        created: createdResponse,
        savedAnswers: answers
      };
    });

    return {
      id: created.id,
      formId: created.formId,
      userId: form.isAnonymous ? null : created.userId,
      submittedAt: created.submittedAt.toISOString(),
      answers: savedAnswers.map((answer) => ({
        id: answer.id,
        questionId: answer.questionId,
        value: answer.value
      }))
    };
  }

  async listDynamicFormResponses(actorId: string, formId: string) {
    const actorRole = await this.getActorRole(actorId);

    if (actorRole !== "ADMINISTRADOR") {
      throw this.forbidden("Solo administradores pueden ver las respuestas completas");
    }

    const form = await this.app.prisma.dynamicForm.findUnique({
      where: { id: formId },
      include: {
        responses: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            answers: {
              include: {
                question: {
                  select: {
                    id: true,
                    label: true,
                    type: true
                  }
                }
              }
            }
          },
          orderBy: {
            submittedAt: "desc"
          }
        }
      }
    });

    if (!form) {
      throw new Error("Formulario no encontrado");
    }

    return {
      formId: form.id,
      isAnonymous: form.isAnonymous,
      totalResponses: form.responses.length,
      responses: form.responses.map((response) => ({
        id: response.id,
        user: form.isAnonymous
          ? null
          : response.user
            ? {
                id: response.user.id,
                fullName: `${response.user.firstName} ${response.user.lastName}`.trim(),
                email: response.user.email
              }
            : null,
        submittedAt: response.submittedAt.toISOString(),
        answers: response.answers.map((answer) => ({
          id: answer.id,
          questionId: answer.questionId,
          questionLabel: answer.question.label,
          questionType: answer.question.type,
          value: answer.value
        }))
      }))
    };
  }

  async getDynamicFormSummary(actorId: string, formId: string) {
    const actorRole = await this.getActorRole(actorId);

    if (!formManagerRoles.has(actorRole)) {
      throw this.forbidden("No tienes permisos para ver resúmenes de formularios");
    }

    const form = await this.app.prisma.dynamicForm.findUnique({
      where: { id: formId },
      include: {
        questions: {
          orderBy: {
            order: "asc"
          }
        },
        responses: {
          include: {
            answers: true
          }
        }
      }
    });

    if (!form) {
      throw new Error("Formulario no encontrado");
    }

    if (actorRole !== "ADMINISTRADOR" && form.createdById !== actorId) {
      throw this.forbidden("Solo el creador o un administrador pueden ver el resumen");
    }

    const answersByQuestion = new Map<string, Array<Prisma.JsonValue>>();

    for (const response of form.responses) {
      for (const answer of response.answers) {
        const bucket = answersByQuestion.get(answer.questionId) ?? [];
        bucket.push(answer.value);
        answersByQuestion.set(answer.questionId, bucket);
      }
    }

    const questions = form.questions.map((question) => {
      const values = answersByQuestion.get(question.id) ?? [];
      const options = this.parseOptions(question.options);

      if (question.type === "multiple_choice") {
        const counts: Record<string, number> = Object.fromEntries((options ?? []).map((option) => [option, 0]));
        for (const raw of values) {
          if (typeof raw === "string" && raw in counts) {
            counts[raw] = (counts[raw] ?? 0) + 1;
          }
        }

        return {
          questionId: question.id,
          label: question.label,
          type: question.type,
          required: question.required,
          options,
          totalAnswers: values.length,
          choiceCounts: counts
        };
      }

      if (question.type === "checkbox") {
        const counts: Record<string, number> = Object.fromEntries((options ?? []).map((option) => [option, 0]));
        for (const raw of values) {
          if (Array.isArray(raw)) {
            for (const item of raw) {
              if (typeof item === "string" && item in counts) {
                counts[item] = (counts[item] ?? 0) + 1;
              }
            }
          }
        }

        return {
          questionId: question.id,
          label: question.label,
          type: question.type,
          required: question.required,
          options,
          totalAnswers: values.length,
          choiceCounts: counts
        };
      }

      if (question.type === "rating") {
        const numericValues = values.filter((value): value is number => typeof value === "number");
        const average =
          numericValues.length > 0
            ? Number((numericValues.reduce((acc, value) => acc + value, 0) / numericValues.length).toFixed(2))
            : null;

        return {
          questionId: question.id,
          label: question.label,
          type: question.type,
          required: question.required,
          options,
          totalAnswers: values.length,
          ratingAverage: average
        };
      }

      return {
        questionId: question.id,
        label: question.label,
        type: question.type,
        required: question.required,
        options,
        totalAnswers: values.length,
        textResponses: values
          .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
          .filter((value) => value.trim().length > 0)
      };
    });

    return {
      formId: form.id,
      totalResponses: form.responses.length,
      questions
    };
  }
}
