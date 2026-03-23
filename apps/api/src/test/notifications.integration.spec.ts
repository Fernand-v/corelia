import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationService } from "../modules/notifications/service.js";

vi.mock("../config/env.js", () => ({
  env: {
    WEB_PUSH_ENABLED: true,
    WEB_PUSH_VAPID_SUBJECT: "mailto:push@corelia.local",
    WEB_PUSH_VAPID_PUBLIC_KEY: "public-key",
    WEB_PUSH_VAPID_PRIVATE_KEY: "private-key"
  }
}));

const createMockApp = () =>
  ({
    prisma: {
      notificationPreference: {
        upsert: vi.fn(),
        findMany: vi.fn()
      },
      notification: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn()
      },
      browserPushSubscription: {
        upsert: vi.fn(),
        updateMany: vi.fn()
      }
    }
  }) as unknown as ConstructorParameters<typeof NotificationService>[0];

describe("NotificationService — upsertPreference", () => {
  it("crea o actualiza una preferencia de notificación", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    const pref = {
      id: crypto.randomUUID(),
      userId,
      event: "TAREA_ASIGNADA" as const,
      channel: "EMAIL" as const,
      frequency: "INMEDIATA" as const,
      enabled: true
    };
    app.prisma.notificationPreference.upsert = vi.fn().mockResolvedValue(pref);

    const service = new NotificationService(app);
    const result = await service.upsertPreference({
      userId,
      event: "TAREA_ASIGNADA",
      channel: "EMAIL",
      frequency: "INMEDIATA",
      enabled: true
    });

    expect(result).toMatchObject({ userId, event: "TAREA_ASIGNADA", channel: "EMAIL" });
  });
});

describe("NotificationService — listPreferences", () => {
  it("devuelve todas las preferencias del usuario", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    app.prisma.notificationPreference.findMany = vi.fn().mockResolvedValue([
      { id: crypto.randomUUID(), userId, event: "TAREA_ASIGNADA", channel: "IN_APP", enabled: true }
    ]);

    const service = new NotificationService(app);
    const result = await service.listPreferences(userId);

    expect(result).toHaveLength(1);
    expect(app.prisma.notificationPreference.findMany).toHaveBeenCalledWith({ where: { userId } });
  });
});

describe("NotificationService — listNotifications", () => {
  it("marca las notificaciones no entregadas como entregadas", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    const notifId = crypto.randomUUID();

    app.prisma.notification.findMany = vi.fn().mockResolvedValue([
      { id: notifId, userId, deliveredAt: null, readAt: null, createdAt: new Date() }
    ]);
    app.prisma.notification.updateMany = vi.fn().mockResolvedValue({ count: 1 });

    const service = new NotificationService(app);
    await service.listNotifications(userId);

    expect(app.prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [notifId] } }),
        data: expect.objectContaining({ deliveredAt: expect.any(Date) })
      })
    );
  });

  it("no actualiza si todas las notificaciones ya fueron entregadas", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();

    app.prisma.notification.findMany = vi.fn().mockResolvedValue([
      { id: crypto.randomUUID(), userId, deliveredAt: new Date(), readAt: null, createdAt: new Date() }
    ]);

    const service = new NotificationService(app);
    await service.listNotifications(userId);

    expect(app.prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it("filtra notificaciones por timestamp cuando se proporciona since", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    const since = "2026-03-01T00:00:00.000Z";
    app.prisma.notification.findMany = vi.fn().mockResolvedValue([]);

    const service = new NotificationService(app);
    await service.listNotifications(userId, since);

    expect(app.prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId, createdAt: { gt: new Date(since) } })
      })
    );
  });
});

describe("NotificationService — markRead", () => {
  it("marca múltiples notificaciones como leídas y retorna el conteo", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    app.prisma.notification.updateMany = vi.fn().mockResolvedValue({ count: 2 });

    const service = new NotificationService(app);
    const result = await service.markRead({ userId, ids });

    expect(result).toEqual({ updated: 2 });
    expect(app.prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, id: { in: ids } },
        data: expect.objectContaining({ readAt: expect.any(Date) })
      })
    );
  });
});

describe("NotificationService — unreadCount", () => {
  it("devuelve el conteo de notificaciones no leídas", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    app.prisma.notification.count = vi.fn().mockResolvedValue(5);

    const service = new NotificationService(app);
    const result = await service.unreadCount(userId);

    expect(result).toEqual({ unread: 5 });
    expect(app.prisma.notification.count).toHaveBeenCalledWith({ where: { userId, readAt: null } });
  });

  it("retorna cero cuando no hay notificaciones sin leer", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    app.prisma.notification.count = vi.fn().mockResolvedValue(0);

    const service = new NotificationService(app);
    const result = await service.unreadCount(userId);

    expect(result).toEqual({ unread: 0 });
  });
});

describe("NotificationService browser push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns browser push config when enabled", () => {
    const service = new NotificationService(createMockApp());

    expect(service.getBrowserPushConfig()).toEqual({
      enabled: true,
      publicKey: "public-key"
    });
  });

  it("stores browser push subscriptions for the authenticated user", async () => {
    const app = createMockApp();
    app.prisma.browserPushSubscription.upsert = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      endpoint: "https://push.example.test/subscriptions/1",
      isActive: true,
      createdAt: new Date("2026-03-20T14:00:00.000Z"),
      updatedAt: new Date("2026-03-20T14:05:00.000Z")
    });

    const service = new NotificationService(app);
    const result = await service.upsertBrowserPushSubscription({
      userId: crypto.randomUUID(),
      subscription: {
        endpoint: "https://push.example.test/subscriptions/1",
        expirationTime: 1_773_981_600_000,
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key"
        }
      },
      userAgent: "Vitest"
    });

    expect(app.prisma.browserPushSubscription.upsert).toHaveBeenCalledWith({
      where: {
        endpoint: "https://push.example.test/subscriptions/1"
      },
      update: expect.objectContaining({
        p256dh: "p256dh-key",
        auth: "auth-key",
        userAgent: "Vitest",
        isActive: true
      }),
      create: expect.objectContaining({
        endpoint: "https://push.example.test/subscriptions/1",
        p256dh: "p256dh-key",
        auth: "auth-key",
        userAgent: "Vitest",
        isActive: true
      }),
      select: {
        id: true,
        endpoint: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    expect(result.createdAt).toBe("2026-03-20T14:00:00.000Z");
    expect(result.updatedAt).toBe("2026-03-20T14:05:00.000Z");
  });

  it("deactivates a browser push subscription on unsubscribe", async () => {
    const app = createMockApp();
    app.prisma.browserPushSubscription.updateMany = vi.fn().mockResolvedValue({ count: 1 });

    const service = new NotificationService(app);
    const result = await service.removeBrowserPushSubscription({
      userId: crypto.randomUUID(),
      endpoint: "https://push.example.test/subscriptions/1"
    });

    expect(app.prisma.browserPushSubscription.updateMany).toHaveBeenCalledWith({
      where: {
        userId: expect.any(String),
        endpoint: "https://push.example.test/subscriptions/1",
        isActive: true
      },
      data: {
        isActive: false,
        lastSeenAt: expect.any(Date)
      }
    });
    expect(result).toEqual({ removed: 1 });
  });
});
