import { describe, expect, it, vi } from "vitest";
import { AnnouncementService } from "../modules/announcements/service.js";

const buildAnnouncementBody = (blocks: Array<Record<string, unknown>>) =>
  JSON.stringify({
    kind: "CORELIA_ANNOUNCEMENT_V1",
    version: 1,
    summary: "Resumen",
    blocks,
    audience: {
      userIds: []
    }
  });

const createMockApp = () =>
  ({
    prisma: {
      announcement: {
        findUnique: vi.fn(),
        delete: vi.fn()
      }
    },
    storage: {
      removeObject: vi.fn().mockResolvedValue(undefined)
    },
    jwt: {
      verify: vi.fn()
    },
    log: {
      warn: vi.fn()
    }
  }) as unknown as ConstructorParameters<typeof AnnouncementService>[0];

describe("AnnouncementService delete", () => {
  it("deletes announcement and removes referenced announcement assets", async () => {
    const app = createMockApp();
    app.prisma.announcement.findUnique = vi.fn().mockResolvedValue({
      id: "a-1",
      title: "Anuncio",
      expiresAt: new Date("2026-03-31T10:00:00.000Z"),
      body: buildAnnouncementBody([
        {
          type: "IMAGE",
          url: "/api/v1/announcements/assets/content?token=img-token",
          alt: ""
        },
        {
          type: "FILE",
          label: "Política",
          url: "/api/v1/announcements/assets/content?token=file-token"
        }
      ])
    });
    app.prisma.announcement.delete = vi.fn().mockResolvedValue({ id: "a-1" });
    app.jwt.verify = vi.fn().mockImplementation(async (token: string) => {
      if (token === "img-token") {
        return {
          typ: "announcement_asset",
          key: "announcement/user-1/img.webp"
        };
      }

      if (token === "file-token") {
        return {
          typ: "announcement_asset",
          key: "announcement/user-1/file.pdf"
        };
      }

      return {};
    });

    const service = new AnnouncementService(app);
    const result = await service.deleteById({ announcementId: "a-1" });

    expect(result).toEqual({
      id: "a-1",
      deleted: true,
      title: "Anuncio",
      expiresAt: "2026-03-31T10:00:00.000Z"
    });
    expect(app.prisma.announcement.delete).toHaveBeenCalledWith({
      where: { id: "a-1" }
    });
    expect(app.storage?.removeObject).toHaveBeenCalledTimes(2);
    expect(app.storage?.removeObject).toHaveBeenCalledWith("announcement/user-1/img.webp");
    expect(app.storage?.removeObject).toHaveBeenCalledWith("announcement/user-1/file.pdf");
  });

  it("ignores non announcement-managed asset URLs when deleting", async () => {
    const app = createMockApp();
    app.prisma.announcement.findUnique = vi.fn().mockResolvedValue({
      id: "a-2",
      title: "Anuncio externo",
      expiresAt: new Date("2026-03-31T10:00:00.000Z"),
      body: buildAnnouncementBody([
        {
          type: "IMAGE",
          url: "https://example.com/banner.png",
          alt: ""
        },
        {
          type: "FILE",
          label: "Documento",
          url: "/api/v1/documents/assets/content?token=doc-token"
        }
      ])
    });
    app.prisma.announcement.delete = vi.fn().mockResolvedValue({ id: "a-2" });
    app.jwt.verify = vi.fn();

    const service = new AnnouncementService(app);
    await service.deleteById({ announcementId: "a-2" });

    expect(app.storage?.removeObject).not.toHaveBeenCalled();
    expect(app.jwt.verify).not.toHaveBeenCalled();
  });

  it("keeps deletion successful even when asset cleanup fails", async () => {
    const app = createMockApp();
    app.prisma.announcement.findUnique = vi.fn().mockResolvedValue({
      id: "a-3",
      title: "Anuncio con error de storage",
      expiresAt: new Date("2026-03-31T10:00:00.000Z"),
      body: buildAnnouncementBody([
        {
          type: "IMAGE",
          url: "/announcements/assets/content?token=img-token",
          alt: ""
        }
      ])
    });
    app.prisma.announcement.delete = vi.fn().mockResolvedValue({ id: "a-3" });
    app.jwt.verify = vi.fn().mockResolvedValue({
      typ: "announcement_asset",
      key: "announcement/user-2/img.webp"
    });
    app.storage!.removeObject = vi.fn().mockRejectedValue(new Error("storage unavailable"));

    const service = new AnnouncementService(app);
    const result = await service.deleteById({ announcementId: "a-3" });

    expect(result.deleted).toBe(true);
    expect(app.prisma.announcement.delete).toHaveBeenCalledWith({
      where: { id: "a-3" }
    });
    expect(app.log.warn).toHaveBeenCalledTimes(1);
  });

  it("throws controlled error when announcement does not exist", async () => {
    const app = createMockApp();
    app.prisma.announcement.findUnique = vi.fn().mockResolvedValue(null);

    const service = new AnnouncementService(app);

    await expect(service.deleteById({ announcementId: "missing-id" })).rejects.toThrowError(
      "Anuncio no encontrado"
    );
    expect(app.prisma.announcement.delete).not.toHaveBeenCalled();
  });
});
