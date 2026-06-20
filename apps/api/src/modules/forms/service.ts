import { Prisma } from "@prisma/client";
import type { ConditionalLogic, DynamicFormQuestionType, RoleCode } from "@corelia/types";
import type { FastifyInstance } from "fastify";
import { attachTraceContext } from "../../lib/tracing.js";
import {
  mapDynamicForm,
  mapDynamicQuestion,
  normalizeAnswerValue,
  normalizeOptions,
  parseOptions,
  shouldShowQuestion,
  toInputJson
} from "./form-helpers.js";
import { FormRequestsService } from "./form-requests-service.js";

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
  conditionalLogic?: ConditionalLogic | null;
};

export class FormService {
  private readonly requests: FormRequestsService;

  constructor(private readonly app: FastifyInstance) {
    this.requests = new FormRequestsService(this.app);
  }

  // Solicitudes legacy (VACACIONES/PERMISO/ACCESO): delegadas en FormRequestsService.
  create(input: Parameters<FormRequestsService["create"]>[0]) {
    return this.requests.create(input);
  }

  resolve(input: Parameters<FormRequestsService["resolve"]>[0]) {
    return this.requests.resolve(input);
  }

  listForUser(userId: string) {
    return this.requests.listForUser(userId);
  }

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

    return mapDynamicForm(created);
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

    return mapDynamicForm(updated);
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

    return forms.map((form) => mapDynamicForm(form));
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
      ...mapDynamicForm(form),
      questions: form.questions.map((question) => mapDynamicQuestion(question)),
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

    const options = normalizeOptions(input.options);
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
        ...(input.conditionalLogic ? { conditionalLogic: input.conditionalLogic as unknown as Prisma.InputJsonValue } : {}),
        order
      }
    });

    return mapDynamicQuestion(created);
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
      conditionalLogic?: ConditionalLogic | null;
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
        ? normalizeOptions(input.options)
        : parseOptions(existing.options);

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
        ...(input.order !== undefined ? { order: input.order } : {}),
        ...(input.conditionalLogic !== undefined
          ? { conditionalLogic: input.conditionalLogic ? (input.conditionalLogic as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {})
      }
    });

    return mapDynamicQuestion(updated);
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
      const visible = shouldShowQuestion(question, answersByQuestion);
      const hasAnswer = answersByQuestion.has(question.id);

      if (!hasAnswer) {
        if (question.required && visible) {
          throw new Error(`La pregunta "${question.label}" es obligatoria`);
        }
        continue;
      }

      if (!visible) {
        continue;
      }

      const rawValue = answersByQuestion.get(question.id);
      const normalizedValue = normalizeAnswerValue(
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
            value: toInputJson(answer.value)
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

    const result = {
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

    // Fire webhooks for form submission (best-effort, don't block response)
    this.fireFormSubmissionWebhooks(form, result).catch(() => {});

    return result;
  }

  private async fireFormSubmissionWebhooks(
    form: { id: string; title: string; projectId: string | null },
    response: { id: string; formId: string; userId: string | null; submittedAt: string }
  ) {
    if (!this.app.queues) {
      return;
    }

    const endpoints = await this.app.prisma.webhookEndpoint.findMany({
      where: {
        enabled: true
      },
      select: { id: true, event: true }
    });

    const matching = endpoints.filter((endpoint) => endpoint.event === "SOLICITUD_APROBADA");
    if (matching.length === 0) {
      return;
    }

    await Promise.all(
      matching.map((endpoint) =>
        this.app.queues!.webhooks.add(
          "deliver-webhook",
          attachTraceContext({
            endpointId: endpoint.id,
            payload: {
              event: "FORMULARIO_RESPONDIDO",
              formId: form.id,
              formTitle: form.title,
              projectId: form.projectId,
              responseId: response.id,
              userId: response.userId,
              submittedAt: response.submittedAt
            }
          })
        )
      )
    );
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
      const options = parseOptions(question.options);

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

      if (question.type === "nps") {
        const numericValues = values.filter((value): value is number => typeof value === "number");
        const average =
          numericValues.length > 0
            ? Number((numericValues.reduce((acc, value) => acc + value, 0) / numericValues.length).toFixed(2))
            : null;

        let promoters = 0;
        let passives = 0;
        let detractors = 0;
        for (const v of numericValues) {
          if (v >= 9) promoters++;
          else if (v >= 7) passives++;
          else detractors++;
        }

        return {
          questionId: question.id,
          label: question.label,
          type: question.type,
          required: question.required,
          options,
          totalAnswers: values.length,
          npsAverage: average,
          npsBreakdown: { promoters, passives, detractors }
        };
      }

      if (question.type === "file_upload") {
        return {
          questionId: question.id,
          label: question.label,
          type: question.type,
          required: question.required,
          options,
          totalAnswers: values.length,
          fileResponses: values
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .map((path) => ({
              originalName: path.split("/").pop() ?? path,
              url: `/files/form-uploads/${encodeURIComponent(path)}`
            }))
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
