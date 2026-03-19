import { describe, expect, it, vi } from "vitest";
import { FormService } from "../modules/forms/service.js";

const createMockApp = () =>
  ({
    prisma: {
      user: {
        findUnique: vi.fn()
      },
      project: {
        findUnique: vi.fn()
      },
      formRequest: {
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn()
      },
      notification: {
        create: vi.fn()
      },
      webhookEndpoint: {
        findMany: vi.fn().mockResolvedValue([])
      },
      dynamicForm: {
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn()
      },
      dynamicFormQuestion: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateMany: vi.fn()
      },
      dynamicFormResponse: {
        findFirst: vi.fn(),
        create: vi.fn()
      },
      dynamicFormAnswer: {
        createMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([])
      },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
    },
    queues: undefined
  }) as unknown as ConstructorParameters<typeof FormService>[0];

describe("FormService dynamic forms", () => {
  it("denies dynamic form creation for non-manager roles", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();

    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRole: {
        key: "COLABORADOR"
      }
    });

    const service = new FormService(app);

    await expect(
      service.createDynamicForm(actorId, {
        title: "Encuesta interna"
      })
    ).rejects.toMatchObject({
      name: "Forbidden"
    });
    expect(app.prisma.dynamicForm.create).not.toHaveBeenCalled();
  });

  it("prevents duplicate submissions when multiple answers are disabled", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    const formId = crypto.randomUUID();
    const questionId = crypto.randomUUID();

    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRole: {
        key: "COLABORADOR"
      }
    });
    app.prisma.dynamicForm.findUnique = vi.fn().mockResolvedValue({
      id: formId,
      title: "Pulse check",
      description: null,
      createdById: crypto.randomUUID(),
      projectId: null,
      isActive: true,
      allowMultipleSubmissions: false,
      isAnonymous: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      questions: [
        {
          id: questionId,
          formId,
          type: "short_text",
          label: "¿Qué mejorarías?",
          required: true,
          options: null,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });
    app.prisma.dynamicFormResponse.findFirst = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });

    const service = new FormService(app);

    await expect(
      service.submitDynamicForm(actorId, formId, {
        answers: [{ questionId, value: "Más sincronización" }]
      })
    ).rejects.toThrow("Ya enviaste respuestas para este formulario");
  });

  it("builds aggregated summary for choice, checkbox, rating and text questions", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    const formId = crypto.randomUUID();

    const qChoice = crypto.randomUUID();
    const qCheckbox = crypto.randomUUID();
    const qRating = crypto.randomUUID();
    const qText = crypto.randomUUID();

    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRole: {
        key: "ADMINISTRADOR"
      }
    });
    app.prisma.dynamicForm.findUnique = vi.fn().mockResolvedValue({
      id: formId,
      createdById: crypto.randomUUID(),
      questions: [
        {
          id: qChoice,
          label: "Herramienta preferida",
          type: "multiple_choice",
          required: true,
          options: ["Notion", "Jira"],
          order: 0
        },
        {
          id: qCheckbox,
          label: "Canales usados",
          type: "checkbox",
          required: false,
          options: ["Slack", "Email", "Meet"],
          order: 1
        },
        {
          id: qRating,
          label: "Satisfacción",
          type: "rating",
          required: true,
          options: null,
          order: 2
        },
        {
          id: qText,
          label: "Comentario",
          type: "long_text",
          required: false,
          options: null,
          order: 3
        }
      ],
      responses: [
        {
          answers: [
            { questionId: qChoice, value: "Notion" },
            { questionId: qCheckbox, value: ["Slack", "Email"] },
            { questionId: qRating, value: 4 },
            { questionId: qText, value: "Buen avance" }
          ]
        },
        {
          answers: [
            { questionId: qChoice, value: "Jira" },
            { questionId: qCheckbox, value: ["Email"] },
            { questionId: qRating, value: 2 },
            { questionId: qText, value: "Faltan reportes" }
          ]
        },
        {
          answers: [
            { questionId: qChoice, value: "Notion" },
            { questionId: qCheckbox, value: ["Slack"] },
            { questionId: qRating, value: 5 },
            { questionId: qText, value: "" }
          ]
        }
      ]
    });

    const service = new FormService(app);

    const summary = await service.getDynamicFormSummary(actorId, formId);

    expect(summary.formId).toBe(formId);
    expect(summary.totalResponses).toBe(3);

    const choice = summary.questions.find((item: { questionId: string }) => item.questionId === qChoice);
    expect(choice?.choiceCounts).toEqual({
      Notion: 2,
      Jira: 1
    });

    const checkbox = summary.questions.find((item: { questionId: string }) => item.questionId === qCheckbox);
    expect(checkbox?.choiceCounts).toEqual({
      Slack: 2,
      Email: 2,
      Meet: 0
    });

    const rating = summary.questions.find((item: { questionId: string }) => item.questionId === qRating);
    expect(rating?.ratingAverage).toBeCloseTo(3.67, 2);

    const text = summary.questions.find((item: { questionId: string }) => item.questionId === qText);
    expect(text?.textResponses).toEqual(["Buen avance", "Faltan reportes"]);
  });
});
