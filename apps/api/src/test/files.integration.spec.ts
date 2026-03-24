import { describe, expect, it, vi } from "vitest";
import { FileService } from "../modules/files/service.js";

const PROJECT_ID = "proj-1";
const FOLDER_ID = "folder-1";

const createMockApp = () =>
  ({
    prisma: {
      project: {
        findUnique: vi.fn().mockResolvedValue({ id: PROJECT_ID, name: "Proyecto Test" })
      },
      folder: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn()
      },
      fileObject: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      $queryRaw: vi.fn().mockResolvedValue([])
    },
    storage: {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObjectStream: vi.fn(),
      removeObject: vi.fn().mockResolvedValue(undefined)
    },
    searchIndex: {
      syncFile: vi.fn()
    }
  }) as unknown as ConstructorParameters<typeof FileService>[0];

const makeFile = (id: string, date: Date) => ({
  id,
  folderId: FOLDER_ID,
  ownerId: "u-1",
  originalName: `archivo-${id}.pdf`,
  mimeType: "application/pdf",
  sizeBytes: 1024,
  minioPath: `projects/${PROJECT_ID}/${id}.pdf`,
  createdAt: date,
  owner: { firstName: "Ana", lastName: "García" },
  folder: { name: "Documentos" }
});

describe("FileService — listProjectExplorer", () => {
  it("returns empty files when no folder is provided", async () => {
    const app = createMockApp();
    const service = new FileService(app);

    const result = await service.listProjectExplorer({ projectId: PROJECT_ID });

    expect(result.files).toHaveLength(0);
    expect(result.currentFolder).toBeNull();
    expect(result.breadcrumbs).toHaveLength(0);
  });

  it("throws when project is not found", async () => {
    const app = createMockApp();
    app.prisma.project.findUnique = vi.fn().mockResolvedValue(null);
    const service = new FileService(app);

    await expect(service.listProjectExplorer({ projectId: "no-existe" })).rejects.toThrow(
      "Proyecto no encontrado"
    );
  });

  it("throws when folder is not found in project", async () => {
    const app = createMockApp();
    app.prisma.folder.findFirst = vi.fn().mockResolvedValue(null);
    const service = new FileService(app);

    await expect(
      service.listProjectExplorer({ projectId: PROJECT_ID, folderId: "bad-folder" })
    ).rejects.toThrow("Carpeta no encontrada");
  });

  it("paginates files and returns nextCursor when there are more", async () => {
    const app = createMockApp();
    app.prisma.folder.findFirst = vi.fn().mockResolvedValue({
      id: FOLDER_ID,
      name: "Documentos",
      parentId: null
    });
    // Return pageSize+1 items to indicate there are more
    const now = new Date();
    const files = Array.from({ length: 6 }, (_, i) =>
      makeFile(`file-${i}`, new Date(now.getTime() - i * 1000))
    );
    app.prisma.fileObject.findMany = vi.fn().mockResolvedValue(files);
    const service = new FileService(app);

    const result = await service.listProjectExplorer({
      projectId: PROJECT_ID,
      folderId: FOLDER_ID,
      pageSize: 5
    });

    expect(result.files).toHaveLength(5); // only pageSize items returned
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("file-4"); // last item ID of the page
  });

  it("returns hasMore=false and nextCursor=null when all items fit in page", async () => {
    const app = createMockApp();
    app.prisma.folder.findFirst = vi.fn().mockResolvedValue({
      id: FOLDER_ID,
      name: "Documentos",
      parentId: null
    });
    const now = new Date();
    const files = Array.from({ length: 3 }, (_, i) =>
      makeFile(`file-${i}`, new Date(now.getTime() - i * 1000))
    );
    app.prisma.fileObject.findMany = vi.fn().mockResolvedValue(files);
    const service = new FileService(app);

    const result = await service.listProjectExplorer({
      projectId: PROJECT_ID,
      folderId: FOLDER_ID,
      pageSize: 50
    });

    expect(result.files).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("uses cursor in query when provided", async () => {
    const app = createMockApp();
    app.prisma.folder.findFirst = vi.fn().mockResolvedValue({
      id: FOLDER_ID,
      name: "Documentos",
      parentId: null
    });
    app.prisma.fileObject.findMany = vi.fn().mockResolvedValue([]);
    const service = new FileService(app);

    await service.listProjectExplorer({
      projectId: PROJECT_ID,
      folderId: FOLDER_ID,
      cursor: "cursor-file-id",
      pageSize: 20
    });

    expect(app.prisma.fileObject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "cursor-file-id" },
        skip: 1
      })
    );
  });

  it("formats owner name and folder name in result", async () => {
    const app = createMockApp();
    app.prisma.folder.findFirst = vi.fn().mockResolvedValue({
      id: FOLDER_ID,
      name: "Docs",
      parentId: null
    });
    app.prisma.fileObject.findMany = vi.fn().mockResolvedValue([makeFile("f-1", new Date())]);
    const service = new FileService(app);

    const result = await service.listProjectExplorer({
      projectId: PROJECT_ID,
      folderId: FOLDER_ID
    });

    expect(result.files[0]).toMatchObject({
      id: "f-1",
      originalName: "archivo-f-1.pdf",
      ownerName: "Ana García",
      folderName: "Documentos"
    });
  });
});
