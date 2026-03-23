import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { AnnouncementContentBlock, AnnouncementScheduleType } from "@corelia/types";
import { parseAnnouncementBody, serializeAnnouncementBody } from "./content.js";

const DEFAULT_ASSET_MIME = "application/octet-stream";
const ANNOUNCEMENT_ASSET_TOKEN_TYPE = "announcement_asset";
const ANNOUNCEMENT_ASSET_PATH_PATTERN = /^\/(?:api\/v1\/)?announcements\/assets\/content$/i;
const ANNOUNCEMENT_CLEANUP_LOCK_KEY = "announcements:cleanup:expired-assets";
const ANNOUNCEMENT_CLEANUP_LOCK_TTL_SECONDS = 5 * 60;

const stripControlChars = (input: string): string =>
  Array.from(input)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");

const sanitizeFileName = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ");

  const safe = stripControlChars(normalized)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ");

  return safe.length > 0 ? safe.slice(0, 255) : "archivo";
};

/**
 * Determina si un anuncio de tipo CUMPLEANOS está activo en la fecha actual.
 * Compara mes y día del anuncio con la fecha actual.
 * El anuncio se muestra durante el día del cumpleaños.
 */
const isBirthdayActiveToday = (recurringMonth: number | null, recurringDay: number | null): boolean => {
  if (recurringMonth == null || recurringDay == null) {
    return false;
  }
  const now = new Date();
  return now.getMonth() + 1 === recurringMonth && now.getDate() === recurringDay;
};

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  allCompany: boolean;
  scheduleType: string;
  startsAt: Date | null;
  expiresAt: Date;
  recurringMonth: number | null;
  recurringDay: number | null;
  createdById: string;
  createdAt: Date;
  teams: Array<{ teamId: string }>;
  users: Array<{ userId: string }>;
};

export class AnnouncementService {
  constructor(private readonly app: FastifyInstance) {}

  private static isAnnouncementAssetUrl(value: string): boolean {
    try {
      const parsed = new URL(value.trim(), "http://corelia.local");
      return ANNOUNCEMENT_ASSET_PATH_PATTERN.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  private async parseAnnouncementAssetKey(url: string): Promise<string | null> {
    if (!AnnouncementService.isAnnouncementAssetUrl(url)) {
      return null;
    }

    try {
      const parsedUrl = new URL(url, "http://corelia.local");
      const token = parsedUrl.searchParams.get("token");
      if (!token) {
        return null;
      }

      const payload = (await this.app.jwt.verify(token)) as Partial<{
        typ: string;
        key: string;
      }>;

      if (
        payload.typ !== ANNOUNCEMENT_ASSET_TOKEN_TYPE ||
        typeof payload.key !== "string" ||
        !payload.key.startsWith("announcement/")
      ) {
        return null;
      }

      return payload.key;
    } catch {
      return null;
    }
  }

  private async collectAnnouncementAssetKeys(blocks: AnnouncementContentBlock[]): Promise<Set<string>> {
    const keys = new Set<string>();

    for (const block of blocks) {
      if (block.type !== "IMAGE" && block.type !== "FILE") {
        continue;
      }

      const candidate = await this.parseAnnouncementAssetKey(block.url.trim());
      if (candidate) {
        keys.add(candidate);
      }
    }

    return keys;
  }

  private async cleanupExpiredAnnouncementsAssets() {
    const storage = this.app.storage;
    if (!storage) {
      return;
    }

    const runCleanup = async () => {
      const now = new Date();
      const expiredAnnouncements = await this.app.prisma.announcement.findMany({
        where: {
          expiresAt: {
            lte: now
          },
          // No limpiar anuncios de cumpleaños que se repiten cada año
          scheduleType: {
            not: "CUMPLEANOS"
          }
        },
        select: {
          id: true,
          body: true
        }
      });

      if (expiredAnnouncements.length === 0) {
        return;
      }

      const keysToDelete = new Set<string>();

      for (const announcement of expiredAnnouncements) {
        const parsedBody = parseAnnouncementBody(announcement.body);
        const keys = await this.collectAnnouncementAssetKeys(parsedBody.blocks);
        for (const key of keys) {
          keysToDelete.add(key);
        }
      }

      for (const objectKey of keysToDelete) {
        try {
          await storage.removeObject(objectKey);
        } catch {
          // Idempotent cleanup: ignore missing objects or transient failures.
        }
      }

      await this.app.prisma.announcement.deleteMany({
        where: {
          id: {
            in: expiredAnnouncements.map((announcement) => announcement.id)
          }
        }
      });
    };

    if (!this.app.redis) {
      await runCleanup();
      return;
    }

    try {
      const lockResult = await this.app.redis.set(
        ANNOUNCEMENT_CLEANUP_LOCK_KEY,
        String(Date.now()),
        "EX",
        ANNOUNCEMENT_CLEANUP_LOCK_TTL_SECONDS,
        "NX"
      );

      if (lockResult !== "OK") {
        return;
      }

      await runCleanup();
    } catch (error) {
      this.app.log.warn(
        {
          err: error
        },
        "No se pudo completar limpieza de assets de anuncios expirados"
      );
    }
  }

  /**
   * Determina si un anuncio es visible según su tipo de programación y fechas.
   */
  private isAnnouncementVisible(announcement: AnnouncementRow): boolean {
    const now = new Date();

    if (announcement.scheduleType === "CUMPLEANOS") {
      return isBirthdayActiveToday(announcement.recurringMonth, announcement.recurringDay);
    }

    // Para PROGRAMADO, verificar que ya haya pasado startsAt
    if (announcement.scheduleType === "PROGRAMADO" && announcement.startsAt) {
      if (now < announcement.startsAt) {
        return false;
      }
    }

    // Para todos: verificar que no haya expirado
    if (now > announcement.expiresAt) {
      return false;
    }

    return true;
  }

  private mapAnnouncementForClient(input: AnnouncementRow) {
    const parsedBody = parseAnnouncementBody(input.body);
    const audienceUserIds = [
      ...new Set(
        (input.users.length > 0
          ? input.users.map((audienceUser) => audienceUser.userId)
          : parsedBody.audienceUserIds
        ).filter(Boolean)
      )
    ];
    return {
      id: input.id,
      title: input.title,
      body: parsedBody.summary,
      ...(parsedBody.blocks.length > 0 ? { content: { blocks: parsedBody.blocks } } : {}),
      audience: {
        allCompany: input.allCompany,
        teamIds: input.teams.map((team) => team.teamId),
        userIds: audienceUserIds
      },
      scheduleType: input.scheduleType as AnnouncementScheduleType,
      startsAt: input.startsAt?.toISOString() ?? null,
      expiresAt: input.expiresAt.toISOString(),
      recurringMonth: input.recurringMonth,
      recurringDay: input.recurringDay,
      createdById: input.createdById,
      createdAt: input.createdAt.toISOString()
    };
  }

  async create(input: {
    title: string;
    body: string;
    content?: { blocks: AnnouncementContentBlock[] };
    audience: { allCompany: boolean; teamIds: string[]; userIds: string[] };
    scheduleType?: AnnouncementScheduleType;
    startsAt?: string | null;
    expiresAt: string;
    recurringMonth?: number | null;
    recurringDay?: number | null;
    createdById: string;
  }) {
    await this.cleanupExpiredAnnouncementsAssets();

    const teamIds = [...new Set(input.audience.teamIds)];
    const userIds = [...new Set(input.audience.userIds)];

    if (!input.audience.allCompany && teamIds.length === 0 && userIds.length === 0) {
      throw new Error("Selecciona audiencia global, equipos o usuarios específicos");
    }

    const scheduleType = input.scheduleType ?? "INMEDIATO";

    // Validaciones según tipo de programación
    if (scheduleType === "PROGRAMADO" && !input.startsAt) {
      throw new Error("Los anuncios programados requieren una fecha de inicio");
    }

    if (scheduleType === "CUMPLEANOS") {
      if (input.recurringMonth == null || input.recurringDay == null) {
        throw new Error("Los anuncios de cumpleaños requieren mes y día");
      }
      if (input.recurringMonth < 1 || input.recurringMonth > 12) {
        throw new Error("El mes debe estar entre 1 y 12");
      }
      if (input.recurringDay < 1 || input.recurringDay > 31) {
        throw new Error("El día debe estar entre 1 y 31");
      }
    }

    const announcement = await this.app.prisma.announcement.create({
      data: {
        title: input.title,
        body: serializeAnnouncementBody({
          summary: input.body,
          blocks: input.content?.blocks ?? [],
          audienceUserIds: userIds
        }),
        allCompany: input.audience.allCompany,
        scheduleType,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        expiresAt: new Date(input.expiresAt),
        recurringMonth: scheduleType === "CUMPLEANOS" ? (input.recurringMonth ?? null) : null,
        recurringDay: scheduleType === "CUMPLEANOS" ? (input.recurringDay ?? null) : null,
        createdById: input.createdById,
        teams: {
          create: teamIds.map((teamId) => ({ teamId }))
        },
        users: {
          create: userIds.map((userId) => ({ userId }))
        }
      },
      include: {
        teams: {
          select: {
            teamId: true
          }
        },
        users: {
          select: {
            userId: true
          }
        }
      }
    });

    return this.mapAnnouncementForClient(announcement);
  }

  async listForUser(userId: string) {
    await this.cleanupExpiredAnnouncementsAssets();

    const teamMemberships = await this.app.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true }
    });
    const teamIds = teamMemberships.map((membership) => membership.teamId);

    const now = new Date();

    // Traer anuncios no expirados + anuncios de cumpleaños (que no expiran por fecha)
    const announcements = await this.app.prisma.announcement.findMany({
      where: {
        OR: [
          {
            scheduleType: { not: "CUMPLEANOS" },
            expiresAt: { gt: now }
          },
          {
            scheduleType: "CUMPLEANOS"
          }
        ]
      },
      include: {
        teams: {
          select: {
            teamId: true
          }
        },
        users: {
          select: {
            userId: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const announcementsForUser = announcements
      .filter((announcement) => this.isAnnouncementVisible(announcement))
      .map((announcement) => {
        const parsedBody = parseAnnouncementBody(announcement.body);
        const inTeams = announcement.teams.some((team) => teamIds.includes(team.teamId));
        const relationUserIds = announcement.users.map((user) => user.userId);
        const inUsers =
          relationUserIds.includes(userId) || parsedBody.audienceUserIds.includes(userId);
        const isCreator = announcement.createdById === userId;

        if (!announcement.allCompany && !inTeams && !inUsers && !isCreator) {
          return null;
        }

        return this.mapAnnouncementForClient(announcement);
      })
      .filter(
        (
          item
        ): item is ReturnType<AnnouncementService["mapAnnouncementForClient"]> => Boolean(item)
      );

    return announcementsForUser;
  }

  async deleteById(input: { announcementId: string }) {
    const announcement = await this.app.prisma.announcement.findUnique({
      where: { id: input.announcementId },
      select: {
        id: true,
        title: true,
        expiresAt: true,
        body: true
      }
    });

    if (!announcement) {
      throw new Error("Anuncio no encontrado");
    }

    const parsedBody = parseAnnouncementBody(announcement.body);
    const keysToDelete = this.app.storage
      ? await this.collectAnnouncementAssetKeys(parsedBody.blocks)
      : new Set<string>();

    await this.app.prisma.announcement.delete({
      where: { id: announcement.id }
    });

    if (this.app.storage && keysToDelete.size > 0) {
      await Promise.allSettled(
        [...keysToDelete].map(async (objectKey) => {
          try {
            await this.app.storage!.removeObject(objectKey);
          } catch (error) {
            this.app.log.warn(
              {
                err: error,
                announcementId: announcement.id,
                objectKey
              },
              "No se pudo eliminar asset de anuncio"
            );
          }
        })
      );
    }

    return {
      id: announcement.id,
      deleted: true as const,
      title: announcement.title,
      expiresAt: announcement.expiresAt.toISOString()
    };
  }

  async uploadAsset(input: {
    createdById: string;
    originalName: string;
    mimeType: string;
    data: Buffer;
  }) {
    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    if (input.data.length <= 0) {
      throw new Error("El archivo está vacío");
    }

    const safeName = sanitizeFileName(input.originalName);
    const safeMime = input.mimeType.trim() || DEFAULT_ASSET_MIME;
    const objectKey = `announcement/${input.createdById}/${Date.now()}-${randomUUID()}-${safeName}`;

    await this.app.storage.putObject(objectKey, input.data, safeMime);

    const token = await this.app.jwt.sign(
      {
        typ: ANNOUNCEMENT_ASSET_TOKEN_TYPE,
        key: objectKey,
        mime: safeMime,
        name: safeName
      },
      {
        expiresIn: "365d"
      }
    );

    return {
      url: `/api/v1/announcements/assets/content?token=${encodeURIComponent(token)}`,
      name: safeName,
      mimeType: safeMime,
      sizeBytes: input.data.length
    };
  }

  async getAssetContent(input: { token: string }) {
    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const payload = (await this.app.jwt.verify(input.token)) as Partial<{
      typ: string;
      key: string;
      mime: string;
      name: string;
    }>;

    if (
      payload.typ !== ANNOUNCEMENT_ASSET_TOKEN_TYPE ||
      typeof payload.key !== "string" ||
      !payload.key.startsWith("announcement/")
    ) {
      throw new Error("Token de recurso inválido");
    }

    const stream = await this.app.storage.getObjectStream(payload.key);

    return {
      stream,
      mimeType: typeof payload.mime === "string" && payload.mime ? payload.mime : DEFAULT_ASSET_MIME,
      fileName: sanitizeFileName(typeof payload.name === "string" ? payload.name : "archivo")
    };
  }
}
