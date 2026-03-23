import type { FastifyInstance } from "fastify";
import {
  buildFileSearchPath,
  buildMessageSearchPath,
  buildProjectSearchPath,
  type SearchAccessContext
} from "./search-index.js";

type SearchResultItem = {
  entity: "TAREA" | "PROYECTO" | "MENSAJE" | "PERSONA" | "ARCHIVO";
  id: string;
  title: string;
  subtitle: string | null;
  path: string;
};

type SearchResult = {
  tasks: SearchResultItem[];
  projects: SearchResultItem[];
  messages: SearchResultItem[];
  people: SearchResultItem[];
  files: SearchResultItem[];
};

const emptySearchResult = (): SearchResult => ({
  tasks: [],
  projects: [],
  messages: [],
  people: [],
  files: []
});

export class SearchService {
  constructor(private readonly app: FastifyInstance) {}

  private async resolveAccess(userId: string, requestedProjectId?: string) {
    const [projectMemberships, teamMemberships] = await Promise.all([
      this.app.prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true }
      }),
      this.app.prisma.teamMember.findMany({
        where: { userId },
        select: { teamId: true }
      })
    ]);

    const accessibleProjectIds = [...new Set(projectMemberships.map((membership) => membership.projectId))];
    const accessibleTeamIds = [...new Set(teamMemberships.map((membership) => membership.teamId))];
    const projectId =
      requestedProjectId && accessibleProjectIds.includes(requestedProjectId)
        ? requestedProjectId
        : null;

    return {
      userId,
      accessibleProjectIds,
      accessibleTeamIds,
      projectId
    } satisfies SearchAccessContext;
  }

  private async searchPeople(query: string, access: SearchAccessContext) {
    const textFilter = {
      OR: [
        { firstName: { contains: query, mode: "insensitive" as const } },
        { lastName: { contains: query, mode: "insensitive" as const } },
        { email: { contains: query, mode: "insensitive" as const } }
      ]
    };

    if (access.projectId) {
      const people = await this.app.prisma.user.findMany({
        where: {
          ...textFilter,
          AND: {
            OR: [
              { projectMemberships: { some: { projectId: access.projectId } } },
              { createdProjects: { some: { id: access.projectId } } }
            ]
          }
        },
        take: 20
      });

      return people.map((user) => ({
        entity: "PERSONA" as const,
        id: user.id,
        title: `${user.firstName} ${user.lastName}`.trim(),
        subtitle: user.email,
        path: "/directory"
      }));
    }

    if (access.accessibleProjectIds.length === 0 && access.accessibleTeamIds.length === 0) {
      return [];
    }

    const people = await this.app.prisma.user.findMany({
      where: {
        ...textFilter,
        AND: {
          OR: [
            ...(access.accessibleProjectIds.length > 0
              ? [
                  { projectMemberships: { some: { projectId: { in: access.accessibleProjectIds } } } },
                  { createdProjects: { some: { id: { in: access.accessibleProjectIds } } } }
                ]
              : []),
            ...(access.accessibleTeamIds.length > 0
              ? [{ teamMemberships: { some: { teamId: { in: access.accessibleTeamIds } } } }]
              : [])
          ]
        }
      },
      take: 20
    });

    return people.map((user) => ({
      entity: "PERSONA" as const,
      id: user.id,
      title: `${user.firstName} ${user.lastName}`.trim(),
      subtitle: user.email,
      path: "/directory"
    }));
  }

  private async searchDatabase(query: string, access: SearchAccessContext): Promise<SearchResult> {
    const projectIds = access.projectId ? [access.projectId] : access.accessibleProjectIds;

    const [tasks, projects, messages, people, files] = await Promise.all([
      projectIds.length === 0
        ? []
        : this.app.prisma.task.findMany({
            where: {
              projectId: { in: projectIds },
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } }
              ]
            },
            take: 20
          }),
      projectIds.length === 0
        ? []
        : this.app.prisma.project.findMany({
            where: {
              id: { in: projectIds },
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } }
              ]
            },
            take: 20
          }),
      this.app.prisma.message.findMany({
        where: {
          OR: [{ content: { contains: query, mode: "insensitive" } }],
          channel: access.projectId
            ? { projectId: access.projectId }
            : {
                OR: [
                  ...(projectIds.length > 0 ? [{ projectId: { in: projectIds } }] : []),
                  { members: { some: { userId: access.userId } } }
                ]
              }
        },
        take: 20,
        include: {
          channel: {
            select: {
              id: true,
              projectId: true,
              teamId: true
            }
          }
        }
      }),
      this.searchPeople(query, access),
      access.projectId
        ? this.app.prisma.fileObject.findMany({
            where: {
              deletedAt: null,
              OR: [{ originalName: { contains: query, mode: "insensitive" } }],
              folder: {
                projectId: access.projectId
              }
            },
            take: 20,
            include: {
              folder: {
                select: {
                  projectId: true,
                  teamId: true
                }
              }
            }
          })
        : projectIds.length === 0 && access.accessibleTeamIds.length === 0
          ? []
          : this.app.prisma.fileObject.findMany({
              where: {
                deletedAt: null,
                OR: [{ originalName: { contains: query, mode: "insensitive" } }],
                folder: {
                  OR: [
                    ...(projectIds.length > 0 ? [{ projectId: { in: projectIds } }] : []),
                    ...(access.accessibleTeamIds.length > 0
                      ? [{ teamId: { in: access.accessibleTeamIds } }]
                      : [])
                  ]
                }
              },
              take: 20,
              include: {
                folder: {
                  select: {
                    projectId: true,
                    teamId: true
                  }
                }
              }
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
        path: buildProjectSearchPath(project.id)
      })),
      messages: messages.map((message) => ({
        entity: "MENSAJE" as const,
        id: message.id,
        title: message.content.slice(0, 80),
        subtitle: null,
        path: buildMessageSearchPath({
          channelId: message.channelId,
          projectId: message.channel.projectId,
          teamId: message.channel.teamId
        })
      })),
      people,
      files: files.map((file) => ({
        entity: "ARCHIVO" as const,
        id: file.id,
        title: file.originalName,
        subtitle: file.mimeType,
        path: buildFileSearchPath({
          projectId: file.folder.projectId,
          teamId: file.folder.teamId
        })
      }))
    };
  }

  async search(input: {
    query: string;
    userId: string;
    projectId?: string;
  }) {
    const access = await this.resolveAccess(input.userId, input.projectId);

    if (input.projectId && !access.projectId) {
      return emptySearchResult();
    }

    if (this.app.searchIndex?.enabled) {
      try {
        const [indexed, people] = await Promise.all([
          this.app.searchIndex.search({
            query: input.query,
            access
          }),
          this.searchPeople(input.query, access)
        ]);

        return {
          ...indexed,
          people
        };
      } catch (error) {
        this.app.log.warn(
          {
            reason: (error as Error).message
          },
          "Búsqueda en Meilisearch falló; se usará fallback SQL"
        );
      }
    }

    return this.searchDatabase(input.query, access);
  }
}
