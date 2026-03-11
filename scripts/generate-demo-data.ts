import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo123!@#";
const SUMMARY_PATH_INPUT = process.env.DEMO_SUMMARY_PATH ?? "docs/demo-data-summary.json";
const SUMMARY_PATH = isAbsolute(SUMMARY_PATH_INPUT)
  ? SUMMARY_PATH_INPUT
  : resolve(REPO_ROOT, SUMMARY_PATH_INPUT);

const TEAM_NAME = "Equipo Demo Plataforma";
const PROJECT_NAME = "Proyecto Demo Orion";
const PROJECT_CHANNEL_NAME = "general-orion";
const TEAM_CHANNEL_NAME = "equipo-plataforma";

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

type DemoUserConfig = {
  email: string;
  firstName: string;
  lastName: string;
  roleKey: string;
};

const demoUsers: DemoUserConfig[] = [
  {
    email: "demo.admin@corelia.local",
    firstName: "Demo",
    lastName: "Admin",
    roleKey: "ADMINISTRADOR"
  },
  {
    email: "demo.lider@corelia.local",
    firstName: "Luna",
    lastName: "Lider",
    roleKey: "LIDER_PROYECTO"
  },
  {
    email: "demo.coordinador@corelia.local",
    firstName: "Carlos",
    lastName: "Coordinador",
    roleKey: "COORDINADOR_EQUIPO"
  },
  {
    email: "demo.dev1@corelia.local",
    firstName: "Daniela",
    lastName: "Dev",
    roleKey: "COLABORADOR"
  },
  {
    email: "demo.dev2@corelia.local",
    firstName: "Diego",
    lastName: "Dev",
    roleKey: "COLABORADOR"
  }
];

const ensureRoleId = async (key: string) => {
  const role = await prisma.role.findUnique({
    where: { key },
    select: { id: true, key: true }
  });

  if (!role) {
    throw new Error(
      `No existe el rol ${key}. Ejecuta primero: corepack pnpm --filter @corelia/api prisma:seed`
    );
  }

  return role.id;
};

const ensureUser = async (
  config: DemoUserConfig,
  passwordHash: string,
  roleIdByKey: Map<string, string>
) => {
  const roleId = roleIdByKey.get(config.roleKey);
  if (!roleId) {
    throw new Error(`RoleId no encontrado para ${config.roleKey}`);
  }

  return prisma.user.upsert({
    where: { email: config.email },
    update: {
      firstName: config.firstName,
      lastName: config.lastName,
      passwordHash,
      baseRoleId: roleId,
      isActive: true
    },
    create: {
      email: config.email,
      firstName: config.firstName,
      lastName: config.lastName,
      passwordHash,
      baseRoleId: roleId,
      isActive: true
    }
  });
};

const ensureProjectStage = async (projectId: string, name: string, order: number, color: string) => {
  const existing = await prisma.projectStage.findFirst({
    where: {
      projectId,
      name
    },
    select: { id: true }
  });

  if (existing) {
    return prisma.projectStage.update({
      where: { id: existing.id },
      data: {
        order,
        color
      }
    });
  }

  return prisma.projectStage.create({
    data: {
      projectId,
      name,
      order,
      color
    }
  });
};

const ensureProjectTask = async (input: {
  projectId: string;
  stageId: string | null;
  title: string;
  description: string;
  createdById: string;
  assigneeId: string;
  status: "PENDIENTE" | "EN_REVISION" | "COMPLETADA";
  startDate: Date;
  dueDate: Date;
}) => {
  const existing = await prisma.task.findFirst({
    where: {
      projectId: input.projectId,
      title: input.title
    },
    select: { id: true }
  });

  const data = {
    stageId: input.stageId,
    title: input.title,
    description: input.description,
    createdById: input.createdById,
    assigneeId: input.assigneeId,
    status: input.status,
    startDate: input.startDate,
    dueDate: input.dueDate,
    completedAt: input.status === "COMPLETADA" ? new Date() : null
  };

  if (existing) {
    return prisma.task.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.task.create({
    data: {
      projectId: input.projectId,
      ...data
    }
  });
};

const ensureChannel = async (input: {
  name: string;
  scope: "PROYECTO" | "EQUIPO";
  projectId: string | null;
  teamId: string | null;
}) => {
  const existing = await prisma.channel.findFirst({
    where: {
      name: input.name,
      scope: input.scope,
      projectId: input.projectId,
      teamId: input.teamId
    },
    select: { id: true }
  });

  if (existing) {
    return prisma.channel.findUniqueOrThrow({ where: { id: existing.id } });
  }

  return prisma.channel.create({
    data: {
      name: input.name,
      scope: input.scope,
      projectId: input.projectId,
      teamId: input.teamId
    }
  });
};

const ensureMessage = async (input: {
  channelId: string;
  authorId: string;
  content: string;
  mentions?: string[];
  kind?: "TEXT" | "CALL_INVITE" | "FILE";
}) => {
  const existing = await prisma.message.findFirst({
    where: {
      channelId: input.channelId,
      authorId: input.authorId,
      content: input.content
    },
    select: { id: true }
  });

  if (existing) {
    return prisma.message.findUniqueOrThrow({ where: { id: existing.id } });
  }

  return prisma.message.create({
    data: {
      channelId: input.channelId,
      authorId: input.authorId,
      kind: input.kind ?? "TEXT",
      content: input.content,
      mentions: input.mentions ?? []
    }
  });
};

const ensureFolder = async (input: {
  projectId: string;
  name: string;
  parentId: string | null;
  createdById: string;
}) => {
  const existing = await prisma.folder.findFirst({
    where: {
      scope: "PROYECTO",
      projectId: input.projectId,
      parentId: input.parentId,
      name: input.name
    },
    select: { id: true }
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.folder.create({
    data: {
      scope: "PROYECTO",
      projectId: input.projectId,
      parentId: input.parentId,
      name: input.name,
      createdById: input.createdById
    },
    select: { id: true }
  });

  return created.id;
};

async function main() {
  const now = new Date();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const roleKeys = Array.from(new Set(demoUsers.map((user) => user.roleKey)));
  const roleIdByKey = new Map<string, string>();
  for (const key of roleKeys) {
    roleIdByKey.set(key, await ensureRoleId(key));
  }

  const users = await Promise.all(
    demoUsers.map((config) => ensureUser(config, passwordHash, roleIdByKey))
  );
  const usersByEmail = new Map(users.map((user) => [user.email, user]));

  const adminUser = usersByEmail.get("demo.admin@corelia.local");
  const leadUser = usersByEmail.get("demo.lider@corelia.local");
  const coordinatorUser = usersByEmail.get("demo.coordinador@corelia.local");
  const dev1User = usersByEmail.get("demo.dev1@corelia.local");
  const dev2User = usersByEmail.get("demo.dev2@corelia.local");

  if (!adminUser || !leadUser || !coordinatorUser || !dev1User || !dev2User) {
    throw new Error("No se pudieron resolver todos los usuarios demo");
  }

  const team = await prisma.team.upsert({
    where: { name: TEAM_NAME },
    update: {
      description: "Equipo de prueba para validar flujos de colaboracion"
    },
    create: {
      name: TEAM_NAME,
      description: "Equipo de prueba para validar flujos de colaboracion"
    }
  });

  await prisma.teamMember.createMany({
    data: [leadUser.id, coordinatorUser.id, dev1User.id, dev2User.id].map((userId) => ({
      teamId: team.id,
      userId
    })),
    skipDuplicates: true
  });

  const existingProject = await prisma.project.findFirst({
    where: {
      name: PROJECT_NAME,
      ownerId: leadUser.id
    }
  });

  const project =
    existingProject ??
    (await prisma.project.create({
      data: {
        name: PROJECT_NAME,
        description: "Proyecto demo para validar operaciones de API y UI",
        template: "SOFTWARE",
        ownerId: leadUser.id,
        startDate: now,
        estimatedEndDate: addDays(now, 90)
      }
    }));

  const memberRoles = [
    { userId: leadUser.id, roleKey: "LIDER_PROYECTO" },
    { userId: coordinatorUser.id, roleKey: "COORDINADOR_EQUIPO" },
    { userId: dev1User.id, roleKey: "COLABORADOR" },
    { userId: dev2User.id, roleKey: "COLABORADOR" },
    { userId: adminUser.id, roleKey: "ADMINISTRADOR" }
  ];

  for (const membership of memberRoles) {
    const roleId = roleIdByKey.get(membership.roleKey);
    if (!roleId) {
      continue;
    }

    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: membership.userId
        }
      },
      update: {
        roleId,
        membershipSource: "MANUAL"
      },
      create: {
        projectId: project.id,
        userId: membership.userId,
        roleId,
        membershipSource: "MANUAL"
      }
    });
  }

  await prisma.projectTeamLink.upsert({
    where: {
      projectId_teamId: {
        projectId: project.id,
        teamId: team.id
      }
    },
    update: {
      createdById: leadUser.id
    },
    create: {
      projectId: project.id,
      teamId: team.id,
      createdById: leadUser.id
    }
  });

  const stageBacklog = await ensureProjectStage(project.id, "Backlog", 1, "#4F7CFF");
  const stageInProgress = await ensureProjectStage(project.id, "En Progreso", 2, "#E6A500");
  const stageReview = await ensureProjectStage(project.id, "Revision", 3, "#7B5CFA");
  const stageDone = await ensureProjectStage(project.id, "Completadas", 4, "#1A9B4A");

  const task1 = await ensureProjectTask({
    projectId: project.id,
    stageId: stageInProgress.id,
    title: "Configurar autenticacion JWT para colaboracion",
    description: "Validar emision de tokens para el servicio colaborativo",
    createdById: leadUser.id,
    assigneeId: dev1User.id,
    status: "EN_REVISION",
    startDate: addDays(now, -3),
    dueDate: addDays(now, 2)
  });

  const task2 = await ensureProjectTask({
    projectId: project.id,
    stageId: stageDone.id,
    title: "Ajustar CORS por entorno",
    description: "Restringir origenes en produccion y permitir localhost en desarrollo",
    createdById: leadUser.id,
    assigneeId: dev2User.id,
    status: "COMPLETADA",
    startDate: addDays(now, -8),
    dueDate: addDays(now, -2)
  });

  const task3 = await ensureProjectTask({
    projectId: project.id,
    stageId: stageBacklog.id,
    title: "Documentar checklist de despliegue",
    description: "Agregar pasos para despliegue seguro y rollback",
    createdById: coordinatorUser.id,
    assigneeId: dev1User.id,
    status: "PENDIENTE",
    startDate: addDays(now, 1),
    dueDate: addDays(now, 7)
  });

  const task4 = await ensureProjectTask({
    projectId: project.id,
    stageId: stageReview.id,
    title: "Refactorizar modulo de admin",
    description: "Separar servicios y reducir acoplamiento del modulo admin",
    createdById: leadUser.id,
    assigneeId: coordinatorUser.id,
    status: "EN_REVISION",
    startDate: addDays(now, -2),
    dueDate: addDays(now, 4)
  });

  const demoTimeEntries = [
    { userId: dev1User.id, taskId: task1.id, minutes: 180, note: "Demo: analisis de tokens" },
    { userId: dev2User.id, taskId: task2.id, minutes: 240, note: "Demo: pruebas de CORS" },
    { userId: coordinatorUser.id, taskId: task4.id, minutes: 120, note: "Demo: coordinacion refactor" }
  ];

  for (const entry of demoTimeEntries) {
    const existing = await prisma.timeEntry.findFirst({
      where: {
        userId: entry.userId,
        taskId: entry.taskId,
        note: entry.note
      },
      select: { id: true }
    });

    if (!existing) {
      await prisma.timeEntry.create({
        data: {
          userId: entry.userId,
          taskId: entry.taskId,
          minutes: entry.minutes,
          note: entry.note,
          loggedAt: addDays(now, -1)
        }
      });
    }
  }

  const projectChannel = await ensureChannel({
    name: PROJECT_CHANNEL_NAME,
    scope: "PROYECTO",
    projectId: project.id,
    teamId: null
  });
  const teamChannel = await ensureChannel({
    name: TEAM_CHANNEL_NAME,
    scope: "EQUIPO",
    projectId: null,
    teamId: team.id
  });

  const channelMemberUserIds = [leadUser.id, coordinatorUser.id, dev1User.id, dev2User.id, adminUser.id];
  await prisma.channelMember.createMany({
    data: channelMemberUserIds.map((userId) => ({
      channelId: projectChannel.id,
      userId
    })),
    skipDuplicates: true
  });
  await prisma.channelMember.createMany({
    data: [leadUser.id, coordinatorUser.id, dev1User.id, dev2User.id].map((userId) => ({
      channelId: teamChannel.id,
      userId
    })),
    skipDuplicates: true
  });

  await ensureMessage({
    channelId: projectChannel.id,
    authorId: leadUser.id,
    content: "Bienvenidos al canal demo del Proyecto Orion."
  });
  await ensureMessage({
    channelId: projectChannel.id,
    authorId: dev1User.id,
    content: "Avance: token colaborativo funcionando en entorno local."
  });
  await ensureMessage({
    channelId: projectChannel.id,
    authorId: coordinatorUser.id,
    content: "Pendiente revisar checklist de despliegue con @Diego.",
    mentions: [dev2User.id]
  });
  await ensureMessage({
    channelId: teamChannel.id,
    authorId: dev2User.id,
    content: "Equipo, hoy cerramos pruebas de seguridad."
  });

  const meetingStartsAt = addDays(now, 1);
  meetingStartsAt.setHours(15, 0, 0, 0);
  const meetingEndsAt = addDays(meetingStartsAt, 0);
  meetingEndsAt.setHours(16, 0, 0, 0);

  let meeting = await prisma.meeting.findFirst({
    where: {
      projectId: project.id,
      title: "Sync semanal Proyecto Orion"
    }
  });

  if (!meeting) {
    meeting = await prisma.meeting.create({
      data: {
        title: "Sync semanal Proyecto Orion",
        description: "Reunion de seguimiento de pendientes criticos",
        projectId: project.id,
        teamId: team.id,
        startsAt: meetingStartsAt,
        endsAt: meetingEndsAt,
        createdById: leadUser.id,
        status: "PROGRAMADA"
      }
    });
  }

  await prisma.meetingParticipant.createMany({
    data: [leadUser.id, coordinatorUser.id, dev1User.id, dev2User.id].map((userId) => ({
      meetingId: meeting.id,
      userId
    })),
    skipDuplicates: true
  });

  await prisma.meetingAgendaItem.upsert({
    where: {
      meetingId_order: {
        meetingId: meeting.id,
        order: 1
      }
    },
    update: {
      text: "Revisar estado de tareas en revision"
    },
    create: {
      meetingId: meeting.id,
      order: 1,
      text: "Revisar estado de tareas en revision"
    }
  });

  await prisma.meetingAgendaItem.upsert({
    where: {
      meetingId_order: {
        meetingId: meeting.id,
        order: 2
      }
    },
    update: {
      text: "Definir prioridades de la semana"
    },
    create: {
      meetingId: meeting.id,
      order: 2,
      text: "Definir prioridades de la semana"
    }
  });

  const meetingNoteExists = await prisma.meetingNote.findFirst({
    where: {
      meetingId: meeting.id,
      content: "Demo: acta base de seguimiento"
    },
    select: { id: true }
  });
  if (!meetingNoteExists) {
    await prisma.meetingNote.create({
      data: {
        meetingId: meeting.id,
        authorId: leadUser.id,
        content: "Demo: acta base de seguimiento"
      }
    });
  }

  const meetingAgreement = await prisma.meetingAgreement.findFirst({
    where: {
      meetingId: meeting.id,
      title: "Publicar reporte de auditoria tecnica"
    },
    select: { id: true }
  });
  if (!meetingAgreement) {
    await prisma.meetingAgreement.create({
      data: {
        meetingId: meeting.id,
        title: "Publicar reporte de auditoria tecnica",
        description: "El reporte debe incluir hallazgos y acciones de mitigacion",
        authorId: coordinatorUser.id,
        status: "VINCULADO_TAREA",
        taskId: task4.id,
        createdTask: false
      }
    });
  }

  const rootFolderId = await ensureFolder({
    projectId: project.id,
    name: "documentos",
    parentId: null,
    createdById: leadUser.id
  });
  const textoFolderId = await ensureFolder({
    projectId: project.id,
    name: "texto",
    parentId: rootFolderId,
    createdById: leadUser.id
  });
  const diagramasFolderId = await ensureFolder({
    projectId: project.id,
    name: "diagramas",
    parentId: rootFolderId,
    createdById: leadUser.id
  });
  const tablasFolderId = await ensureFolder({
    projectId: project.id,
    name: "tablas",
    parentId: rootFolderId,
    createdById: leadUser.id
  });
  const whiteboardFolderId = await ensureFolder({
    projectId: project.id,
    name: "whiteboard",
    parentId: rootFolderId,
    createdById: leadUser.id
  });
  const presentacionesFolderId = await ensureFolder({
    projectId: project.id,
    name: "presentaciones",
    parentId: rootFolderId,
    createdById: leadUser.id
  });

  await prisma.projectDocumentSpace.upsert({
    where: { projectId: project.id },
    update: {
      rootFolderId,
      textoFolderId,
      diagramasFolderId,
      tablasFolderId,
      whiteboardFolderId,
      presentacionesFolderId
    },
    create: {
      projectId: project.id,
      rootFolderId,
      textoFolderId,
      diagramasFolderId,
      tablasFolderId,
      whiteboardFolderId,
      presentacionesFolderId
    }
  });

  const textDocYDoc = `demo-${project.id}-texto`;
  const textDocument =
    (await prisma.collaborativeDocument.findUnique({
      where: { yDocName: textDocYDoc }
    })) ??
    (await prisma.collaborativeDocument.create({
      data: {
        projectId: project.id,
        folderId: textoFolderId,
        type: "TEXTO",
        name: "Plan de Proyecto Orion",
        yDocName: textDocYDoc,
        createdById: leadUser.id,
        currentVersion: 1
      }
    }));

  await prisma.collaborativeDocumentVersion.upsert({
    where: {
      documentId_versionNumber: {
        documentId: textDocument.id,
        versionNumber: 1
      }
    },
    update: {
      kind: "MANUAL",
      snapshotPath: `documents/${project.id}/${textDocument.id}/v1.json`,
      snapshotSizeBytes: 256,
      createdById: leadUser.id
    },
    create: {
      documentId: textDocument.id,
      versionNumber: 1,
      kind: "MANUAL",
      snapshotPath: `documents/${project.id}/${textDocument.id}/v1.json`,
      snapshotSizeBytes: 256,
      createdById: leadUser.id
    }
  });

  const diagramDocYDoc = `demo-${project.id}-diagrama`;
  const diagramDocument =
    (await prisma.collaborativeDocument.findUnique({
      where: { yDocName: diagramDocYDoc }
    })) ??
    (await prisma.collaborativeDocument.create({
      data: {
        projectId: project.id,
        folderId: diagramasFolderId,
        type: "DIAGRAMA",
        name: "Arquitectura de Integracion",
        yDocName: diagramDocYDoc,
        diagramEngine: "REACT_FLOW",
        diagramKind: "ARQUITECTURA",
        createdById: coordinatorUser.id,
        currentVersion: 1
      }
    }));

  await prisma.collaborativeDocumentVersion.upsert({
    where: {
      documentId_versionNumber: {
        documentId: diagramDocument.id,
        versionNumber: 1
      }
    },
    update: {
      kind: "MANUAL",
      snapshotPath: `documents/${project.id}/${diagramDocument.id}/v1.json`,
      snapshotSizeBytes: 256,
      createdById: coordinatorUser.id
    },
    create: {
      documentId: diagramDocument.id,
      versionNumber: 1,
      kind: "MANUAL",
      snapshotPath: `documents/${project.id}/${diagramDocument.id}/v1.json`,
      snapshotSizeBytes: 256,
      createdById: coordinatorUser.id
    }
  });

  const projectDetail =
    (await prisma.projectDetail.findFirst({
      where: {
        projectId: project.id,
        description: "Infraestructura cloud"
      }
    })) ??
    (await prisma.projectDetail.create({
      data: {
        projectId: project.id,
        description: "Infraestructura cloud",
        estimatedBudget: 25000,
        createdById: leadUser.id
      }
    }));

  const ensureExpense = async (input: {
    description: string;
    amount: number;
    status: "PENDIENTE" | "APROBADO";
    createdById: string;
    approvedById?: string;
  }) => {
    const existing = await prisma.expense.findFirst({
      where: {
        projectDetailId: projectDetail.id,
        description: input.description
      },
      select: { id: true }
    });

    if (existing) {
      return prisma.expense.update({
        where: { id: existing.id },
        data: {
          amount: input.amount,
          status: input.status,
          approvedById: input.approvedById ?? null,
          approvedAt: input.status === "APROBADO" ? now : null,
          createdById: input.createdById,
          date: now
        }
      });
    }

    return prisma.expense.create({
      data: {
        projectDetailId: projectDetail.id,
        description: input.description,
        amount: input.amount,
        status: input.status,
        approvedById: input.approvedById ?? null,
        approvedAt: input.status === "APROBADO" ? now : null,
        createdById: input.createdById,
        date: now
      }
    });
  };

  const approvedExpense = await ensureExpense({
    description: "Servidor cloud marzo",
    amount: 4500,
    status: "APROBADO",
    createdById: coordinatorUser.id,
    approvedById: adminUser.id
  });

  const pendingExpense = await ensureExpense({
    description: "Licencias observabilidad",
    amount: 1200,
    status: "PENDIENTE",
    createdById: dev1User.id
  });

  const objective =
    (await prisma.objective.findFirst({
      where: {
        scope: "PROYECTO",
        projectId: project.id,
        title: "Reducir incidencias de despliegue"
      }
    })) ??
    (await prisma.objective.create({
      data: {
        scope: "PROYECTO",
        projectId: project.id,
        title: "Reducir incidencias de despliegue",
        description: "Bajar en 40% los fallos de despliegue en el proximo trimestre",
        ownerId: coordinatorUser.id,
        targetDate: addDays(now, 60),
        progressPct: 35
      }
    }));

  await prisma.objectiveTask.upsert({
    where: {
      objectiveId_taskId: {
        objectiveId: objective.id,
        taskId: task1.id
      }
    },
    update: {},
    create: {
      objectiveId: objective.id,
      taskId: task1.id
    }
  });

  const existingAutomation = await prisma.automationRule.findFirst({
    where: {
      projectId: project.id,
      name: "Notificar cierre de tarea"
    },
    select: { id: true }
  });
  if (existingAutomation) {
    await prisma.automationRule.update({
      where: { id: existingAutomation.id },
      data: {
        event: "TAREA_COMPLETADA",
        action: "ENVIAR_NOTIFICACION",
        enabled: true,
        config: JSON.stringify({ channels: ["IN_APP"], audience: "PROJECT_MEMBERS" })
      }
    });
  } else {
    await prisma.automationRule.create({
      data: {
        projectId: project.id,
        name: "Notificar cierre de tarea",
        event: "TAREA_COMPLETADA",
        action: "ENVIAR_NOTIFICACION",
        enabled: true,
        createdById: leadUser.id,
        config: JSON.stringify({ channels: ["IN_APP"], audience: "PROJECT_MEMBERS" })
      }
    });
  }

  const webhook = await prisma.webhookEndpoint.findFirst({
    where: {
      url: "https://example.invalid/corelia-demo-webhook",
      event: "TAREA_COMPLETADA",
      createdById: adminUser.id
    }
  });
  if (!webhook) {
    await prisma.webhookEndpoint.create({
      data: {
        url: "https://example.invalid/corelia-demo-webhook",
        event: "TAREA_COMPLETADA",
        secret: "demo-secret-change-me",
        enabled: true,
        createdById: adminUser.id
      }
    });
  }

  const announcement = await prisma.announcement.findFirst({
    where: {
      title: "Demo: Inicio de auditoria funcional",
      createdById: adminUser.id
    }
  });
  if (!announcement) {
    await prisma.announcement.create({
      data: {
        title: "Demo: Inicio de auditoria funcional",
        body: "Se cargaron datos de prueba para validar dashboards y modulos.",
        allCompany: true,
        expiresAt: addDays(now, 30),
        createdById: adminUser.id
      }
    });
  }

  const formRequest = await prisma.formRequest.findFirst({
    where: {
      requesterId: dev2User.id,
      type: "VACACIONES",
      status: "PENDIENTE"
    }
  });
  if (!formRequest) {
    await prisma.formRequest.create({
      data: {
        requesterId: dev2User.id,
        type: "VACACIONES",
        payload: JSON.stringify({
          startDate: addDays(now, 15).toISOString(),
          endDate: addDays(now, 20).toISOString(),
          reason: "Viaje familiar demo"
        }),
        status: "PENDIENTE"
      }
    });
  }

  const notificationSamples = [
    {
      userId: dev1User.id,
      event: "TAREA_ASIGNADA" as const,
      title: "Nueva tarea asignada",
      body: "Se te asigno la tarea de autenticacion JWT para colaboracion."
    },
    {
      userId: dev2User.id,
      event: "TAREA_ESTADO_CAMBIADO" as const,
      title: "Estado de tarea actualizado",
      body: "La tarea de CORS paso a completada."
    }
  ];

  for (const notification of notificationSamples) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: notification.userId,
        title: notification.title
      },
      select: { id: true }
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          userId: notification.userId,
          event: notification.event,
          channel: "IN_APP",
          title: notification.title,
          body: notification.body,
          deliveredAt: now
        }
      });
    }
  }

  await prisma.notificationPreference.upsert({
    where: {
      userId_event_channel: {
        userId: dev1User.id,
        event: "TAREA_ASIGNADA",
        channel: "IN_APP"
      }
    },
    update: {
      frequency: "INMEDIATA",
      enabled: true
    },
    create: {
      userId: dev1User.id,
      event: "TAREA_ASIGNADA",
      channel: "IN_APP",
      frequency: "INMEDIATA",
      enabled: true
    }
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name
    },
    team: {
      id: team.id,
      name: team.name
    },
    channels: {
      projectChannelId: projectChannel.id,
      teamChannelId: teamChannel.id
    },
    meeting: {
      id: meeting.id,
      title: meeting.title
    },
    documents: {
      textDocumentId: textDocument.id,
      diagramDocumentId: diagramDocument.id
    },
    expenses: {
      approvedExpenseId: approvedExpense.id,
      pendingExpenseId: pendingExpense.id
    },
    objective: {
      id: objective.id,
      title: objective.title
    },
    users: demoUsers.map((user) => ({
      email: user.email,
      role: user.roleKey,
      password: DEMO_PASSWORD
    }))
  };

  mkdirSync(dirname(SUMMARY_PATH), { recursive: true });
  writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("Datos demo generados correctamente");
  console.log(`Proyecto: ${project.id} (${project.name})`);
  console.log(`Equipo: ${team.id} (${team.name})`);
  console.log(`Resumen escrito en: ${SUMMARY_PATH}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
