import type { FastifyInstance } from "fastify";

export class SearchService {
  constructor(private readonly app: FastifyInstance) {}

  async search(input: {
    query: string;
    userId: string;
    projectId?: string;
  }) {
    const accessibleProjectIds = await this.app.prisma.projectMember.findMany({
      where: { userId: input.userId },
      select: { projectId: true }
    });

    const projectIds = input.projectId
      ? [input.projectId]
      : accessibleProjectIds.map((membership) => membership.projectId);

    const [tasks, projects, messages, people, files] = await Promise.all([
      this.app.prisma.task.findMany({
        where: {
          projectId: { in: projectIds },
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } }
          ]
        },
        take: 20
      }),
      this.app.prisma.project.findMany({
        where: {
          id: { in: projectIds },
          OR: [{ name: { contains: input.query, mode: "insensitive" } }]
        },
        take: 20
      }),
      this.app.prisma.message.findMany({
        where: {
          OR: [{ content: { contains: input.query, mode: "insensitive" } }],
          channel: {
            OR: [
              { projectId: { in: projectIds } },
              { members: { some: { userId: input.userId } } }
            ]
          }
        },
        take: 20
      }),
      this.app.prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: input.query, mode: "insensitive" } },
            { lastName: { contains: input.query, mode: "insensitive" } },
            { email: { contains: input.query, mode: "insensitive" } }
          ]
        },
        take: 20
      }),
      this.app.prisma.fileObject.findMany({
        where: {
          deletedAt: null,
          OR: [{ originalName: { contains: input.query, mode: "insensitive" } }],
          folder: {
            OR: [{ projectId: { in: projectIds } }, { team: { members: { some: { userId: input.userId } } } }]
          }
        },
        take: 20
      })
    ]);

    return {
      tasks: tasks.map((task) => ({
        entity: "TAREA" as const,
        id: task.id,
        title: task.title,
        subtitle: task.status,
        path: `/tasks/${task.id}`
      })),
      projects: projects.map((project) => ({
        entity: "PROYECTO" as const,
        id: project.id,
        title: project.name,
        subtitle: project.template,
        path: `/projects/${project.id}`
      })),
      messages: messages.map((message) => ({
        entity: "MENSAJE" as const,
        id: message.id,
        title: message.content.slice(0, 80),
        subtitle: null,
        path: `/channels/${message.channelId}`
      })),
      people: people.map((user) => ({
        entity: "PERSONA" as const,
        id: user.id,
        title: `${user.firstName} ${user.lastName}`,
        subtitle: user.email,
        path: `/directory/${user.id}`
      })),
      files: files.map((file) => ({
        entity: "ARCHIVO" as const,
        id: file.id,
        title: file.originalName,
        subtitle: file.mimeType,
        path: `/files/${file.id}`
      }))
    };
  }
}
