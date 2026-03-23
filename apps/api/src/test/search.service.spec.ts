import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { SearchService } from "../modules/search/service.js";

const createAppMock = () => {
  const app = {
    prisma: {
      projectMember: {
        findMany: vi.fn()
      },
      teamMember: {
        findMany: vi.fn()
      },
      task: {
        findMany: vi.fn()
      },
      project: {
        findMany: vi.fn()
      },
      message: {
        findMany: vi.fn()
      },
      user: {
        findMany: vi.fn()
      },
      fileObject: {
        findMany: vi.fn()
      }
    },
    searchIndex: {
      enabled: false,
      search: vi.fn()
    },
    log: {
      warn: vi.fn()
    }
  };

  return app as unknown as FastifyInstance & {
    prisma: {
      projectMember: { findMany: ReturnType<typeof vi.fn> };
      teamMember: { findMany: ReturnType<typeof vi.fn> };
      task: { findMany: ReturnType<typeof vi.fn> };
      project: { findMany: ReturnType<typeof vi.fn> };
      message: { findMany: ReturnType<typeof vi.fn> };
      user: { findMany: ReturnType<typeof vi.fn> };
      fileObject: { findMany: ReturnType<typeof vi.fn> };
    };
    searchIndex: {
      enabled: boolean;
      search: ReturnType<typeof vi.fn>;
    };
    log: {
      warn: ReturnType<typeof vi.fn>;
    };
  };
};

describe("SearchService", () => {
  it("uses Meilisearch results when the index is enabled", async () => {
    const app = createAppMock();
    app.prisma.projectMember.findMany.mockResolvedValue([{ projectId: "project-1" }]);
    app.prisma.teamMember.findMany.mockResolvedValue([{ teamId: "team-1" }]);
    app.prisma.user.findMany.mockResolvedValue([
      {
        id: "user-2",
        firstName: "Ana",
        lastName: "Ruiz",
        email: "ana@corelia.local"
      }
    ]);
    app.searchIndex.enabled = true;
    app.searchIndex.search.mockResolvedValue({
      tasks: [
        {
          entity: "TAREA",
          id: "task-1",
          title: "Auditar permisos",
          subtitle: "EN_REVISION",
          path: "/tasks/task-1"
        }
      ],
      projects: [],
      messages: [],
      files: []
    });

    const service = new SearchService(app);
    const result = await service.search({
      query: "permisos",
      userId: "user-1",
      projectId: "project-1"
    });

    expect(app.searchIndex.search).toHaveBeenCalledWith({
      query: "permisos",
      access: {
        userId: "user-1",
        accessibleProjectIds: ["project-1"],
        accessibleTeamIds: ["team-1"],
        projectId: "project-1"
      }
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.people).toEqual([
      {
        entity: "PERSONA",
        id: "user-2",
        title: "Ana Ruiz",
        subtitle: "ana@corelia.local",
        path: "/directory"
      }
    ]);
  });

  it("falls back to SQL search when Meilisearch fails", async () => {
    const app = createAppMock();
    app.prisma.projectMember.findMany.mockResolvedValue([{ projectId: "project-1" }]);
    app.prisma.teamMember.findMany.mockResolvedValue([{ teamId: "team-1" }]);
    app.searchIndex.enabled = true;
    app.searchIndex.search.mockRejectedValue(new Error("meili down"));

    app.prisma.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        title: "Documentar búsqueda",
        status: "PENDIENTE"
      }
    ]);
    app.prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        name: "Corelia",
        template: "SOFTWARE"
      }
    ]);
    app.prisma.message.findMany.mockResolvedValue([
      {
        id: "message-1",
        channelId: "channel-1",
        content: "Hay que revisar Meilisearch",
        channel: {
          id: "channel-1",
          projectId: "project-1",
          teamId: null
        }
      }
    ]);
    app.prisma.user.findMany.mockResolvedValue([
      {
        id: "user-2",
        firstName: "Luis",
        lastName: "Mena",
        email: "luis@corelia.local"
      }
    ]);
    app.prisma.fileObject.findMany.mockResolvedValue([
      {
        id: "file-1",
        originalName: "search-plan.pdf",
        mimeType: "application/pdf",
        folder: {
          projectId: "project-1",
          teamId: null
        }
      }
    ]);

    const service = new SearchService(app);
    const result = await service.search({
      query: "search",
      userId: "user-1"
    });

    expect(app.log.warn).toHaveBeenCalled();
    expect(result.tasks[0]?.id).toBe("task-1");
    expect(result.projects[0]?.path).toBe("/projects?projectId=project-1");
    expect(result.messages[0]?.path).toBe("/messaging?channelId=channel-1&projectId=project-1");
    expect(result.files[0]?.path).toBe("/files?projectId=project-1");
  });

  it("returns empty results when the requested project is outside the user scope", async () => {
    const app = createAppMock();
    app.prisma.projectMember.findMany.mockResolvedValue([{ projectId: "project-1" }]);
    app.prisma.teamMember.findMany.mockResolvedValue([]);

    const service = new SearchService(app);
    const result = await service.search({
      query: "privado",
      userId: "user-1",
      projectId: "project-9"
    });

    expect(result).toEqual({
      tasks: [],
      projects: [],
      messages: [],
      people: [],
      files: []
    });
    expect(app.prisma.task.findMany).not.toHaveBeenCalled();
    expect(app.searchIndex.search).not.toHaveBeenCalled();
  });
});
