import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Env mutable para poder alternar ONLYOFFICE_JWT_SECRET / URLs entre pruebas.
// vi.hoisted permite referenciar `env` dentro de la factory hoisteada de vi.mock.
const { env } = vi.hoisted(() => ({
  env: {
    ONLYOFFICE_DOCUMENT_SERVER_URL: "",
    ONLYOFFICE_INTERNAL_URL: "",
    ONLYOFFICE_CALLBACK_BASE_URL: "",
    CORELIA_APP_URL: "http://localhost:3000",
    ONLYOFFICE_JWT_SECRET: ""
  }
}));

vi.mock("../config/env.js", () => ({ env }));

import { DocumentOnlyOfficeService } from "../modules/documents/document-onlyoffice-service.js";

type Ctor = ConstructorParameters<typeof DocumentOnlyOfficeService>;

type RenderedConfig = {
  documentType: string;
  type: string;
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions: { edit: boolean; review: boolean; download: boolean };
  };
  editorConfig: {
    mode: string;
    callbackUrl: string;
    user: { id: string; name: string };
  };
  token?: string;
};

const resetEnv = () => {
  env.ONLYOFFICE_DOCUMENT_SERVER_URL = "";
  env.ONLYOFFICE_INTERNAL_URL = "";
  env.ONLYOFFICE_CALLBACK_BASE_URL = "";
  env.CORELIA_APP_URL = "http://localhost:3000";
  env.ONLYOFFICE_JWT_SECRET = "";
};

type BuildOptions = {
  docType?: string;
  app?: Record<string, unknown>;
  document?: Record<string, unknown>;
  saveVersion?: ReturnType<typeof vi.fn>;
};

const buildService = (options: BuildOptions = {}) => {
  const document = {
    id: "doc-1",
    type: options.docType ?? "TEXTO",
    name: "Mi Documento",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...options.document
  };
  const getDocumentForUser = vi.fn().mockResolvedValue(document) as unknown as Ctor[1];
  const saveVersion = (options.saveVersion ?? vi.fn().mockResolvedValue(undefined)) as unknown as Ctor[2];
  const app = (options.app ?? {
    prisma: {},
    storage: {},
    jwt: {}
  }) as unknown as Ctor[0];
  const service = new DocumentOnlyOfficeService(app, getDocumentForUser, saveVersion);
  return { service, getDocumentForUser, saveVersion, document, app };
};

beforeEach(() => {
  resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DocumentOnlyOfficeService.getOnlyOfficeConfig", () => {
  it("rejects unsupported document types", async () => {
    const { service } = buildService({ docType: "DIAGRAMA" });
    await expect(
      service.getOnlyOfficeConfig({ documentId: "doc-1", userId: "u-1", canEdit: true })
    ).rejects.toThrow(/texto, tabla y presentación/);
  });

  it("rejects when storage is unavailable", async () => {
    const { service } = buildService({ app: { prisma: {}, storage: null, jwt: {} } });
    await expect(
      service.getOnlyOfficeConfig({ documentId: "doc-1", userId: "u-1", canEdit: true })
    ).rejects.toThrow(/almacenamiento no disponible/);
  });

  it("rejects when the document has no base version", async () => {
    const app = {
      storage: {},
      jwt: { sign: vi.fn() },
      prisma: {
        collaborativeDocumentVersion: { findFirst: vi.fn().mockResolvedValue(null) },
        user: { findUnique: vi.fn() }
      }
    };
    const { service } = buildService({ app });
    await expect(
      service.getOnlyOfficeConfig({ documentId: "doc-1", userId: "u-1", canEdit: true })
    ).rejects.toThrow(/archivo base/);
  });

  it("builds a config with file and callback URLs and respects canEdit=false", async () => {
    const sign = vi.fn().mockResolvedValue("signed-token");
    const app = {
      storage: {},
      jwt: { sign },
      prisma: {
        collaborativeDocumentVersion: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: "v-1", versionNumber: 3, snapshotPath: "docs/doc-1/v3.docx" })
        },
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ firstName: "Ana", lastName: "Pérez", email: "ana@x.io" })
        }
      }
    };
    const { service } = buildService({ app });

    const result = await service.getOnlyOfficeConfig({
      documentId: "doc-1",
      userId: "u-1",
      canEdit: false
    });

    expect(result.documentServerUrl).toBe("/onlyoffice");
    const config = result.config as unknown as RenderedConfig;
    expect(config.documentType).toBe("word");
    expect(config.document.permissions.edit).toBe(false);
    expect(config.editorConfig.mode).toBe("view");
    expect(config.editorConfig.user).toEqual({ id: "u-1", name: "Ana Pérez" });
    expect(config.document.url).toContain("/api/v1/documents/doc-1/onlyoffice/file?token=");
    expect(config.editorConfig.callbackUrl).toContain(
      "/api/v1/documents/doc-1/onlyoffice/callback?token="
    );
    // Sin ONLYOFFICE_JWT_SECRET no debe firmar el config completo.
    expect(config.token).toBeUndefined();
  });

  it("adds a signed token to the config when ONLYOFFICE_JWT_SECRET is set", async () => {
    env.ONLYOFFICE_JWT_SECRET = "super-secret";
    env.ONLYOFFICE_DOCUMENT_SERVER_URL = "https://office.example.com/";
    const sign = vi.fn().mockResolvedValue("signed");
    const app = {
      storage: {},
      jwt: { sign },
      prisma: {
        collaborativeDocumentVersion: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: "v-1", versionNumber: 1, snapshotPath: "docs/doc-1/v1.docx" })
        },
        user: { findUnique: vi.fn().mockResolvedValue(null) }
      }
    };
    const { service } = buildService({ app });

    const result = await service.getOnlyOfficeConfig({
      documentId: "doc-1",
      userId: "u-9",
      canEdit: true
    });

    // URL pública normalizada sin barra final.
    expect(result.documentServerUrl).toBe("https://office.example.com");
    const config = result.config as unknown as RenderedConfig;
    expect(config.token).toBe("signed");
    // Falta de usuario => nombre por defecto.
    expect(config.editorConfig.user.name).toBe("Usuario u-9");
    // Se firmó el config con la clave del secreto.
    expect(sign).toHaveBeenCalledWith(expect.any(Object), { key: "super-secret" });
  });
});

describe("DocumentOnlyOfficeService.getOnlyOfficeFileContent", () => {
  it("returns the stream for a valid file token", async () => {
    const stream = { pipe: vi.fn() };
    const app = {
      storage: { getObjectStream: vi.fn().mockResolvedValue(stream) },
      jwt: {
        verify: vi.fn().mockResolvedValue({
          typ: "onlyoffice_file",
          documentId: "doc-1",
          snapshotPath: "docs/doc-1/v1.docx",
          fileName: "Mi_Documento.docx",
          mimeType: "application/docx"
        })
      },
      prisma: {}
    };
    const { service } = buildService({ app });

    const result = await service.getOnlyOfficeFileContent({ documentId: "doc-1", token: "t" });

    expect(result.stream).toBe(stream);
    expect(result.fileName).toBe("Mi_Documento.docx");
    expect(app.storage.getObjectStream).toHaveBeenCalledWith("docs/doc-1/v1.docx");
  });

  it("rejects a token with the wrong type", async () => {
    const app = {
      storage: { getObjectStream: vi.fn() },
      jwt: { verify: vi.fn().mockResolvedValue({ typ: "other", documentId: "doc-1" }) },
      prisma: {}
    };
    const { service } = buildService({ app });

    await expect(
      service.getOnlyOfficeFileContent({ documentId: "doc-1", token: "t" })
    ).rejects.toThrow(/Token de ONLYOFFICE inválido/);
  });

  it("rejects a token issued for a different document", async () => {
    const app = {
      storage: { getObjectStream: vi.fn() },
      jwt: {
        verify: vi.fn().mockResolvedValue({
          typ: "onlyoffice_file",
          documentId: "doc-OTHER",
          snapshotPath: "p",
          fileName: "f",
          mimeType: "m"
        })
      },
      prisma: {}
    };
    const { service } = buildService({ app });

    await expect(
      service.getOnlyOfficeFileContent({ documentId: "doc-1", token: "t" })
    ).rejects.toThrow(/Token de ONLYOFFICE inválido/);
  });
});

describe("DocumentOnlyOfficeService.handleOnlyOfficeCallback", () => {
  const validToken = {
    typ: "onlyoffice_callback",
    documentId: "doc-1",
    userId: "u-1"
  };

  const buildCallbackApp = () => ({
    prisma: {},
    storage: {},
    jwt: { verify: vi.fn().mockResolvedValue(validToken) }
  });

  it("rejects an invalid callback token", async () => {
    const app = { prisma: {}, storage: {}, jwt: { verify: vi.fn().mockResolvedValue({ typ: "x" }) } };
    const { service } = buildService({ app });
    await expect(
      service.handleOnlyOfficeCallback({ documentId: "doc-1", token: "t", body: { status: 2 } })
    ).rejects.toThrow(/Callback de ONLYOFFICE inválido/);
  });

  it("ignores non-actionable statuses without saving", async () => {
    const saveVersion = vi.fn();
    const { service } = buildService({ app: buildCallbackApp(), saveVersion });
    const result = await service.handleOnlyOfficeCallback({
      documentId: "doc-1",
      token: "t",
      body: { status: 1 }
    });
    expect(result).toEqual({ error: 0 });
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("acknowledges error statuses (3,7) without saving", async () => {
    const saveVersion = vi.fn();
    const { service } = buildService({ app: buildCallbackApp(), saveVersion });
    for (const status of [3, 7]) {
      const result = await service.handleOnlyOfficeCallback({
        documentId: "doc-1",
        token: "t",
        body: { status }
      });
      expect(result).toEqual({ error: 0 });
    }
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("throws when an actionable status has no file URL", async () => {
    const { service } = buildService({ app: buildCallbackApp() });
    await expect(
      service.handleOnlyOfficeCallback({ documentId: "doc-1", token: "t", body: { status: 2 } })
    ).rejects.toThrow(/no envió la URL/);
  });

  it("saves a MANUAL version on status 2", async () => {
    const saveVersion = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });
    vi.stubGlobal("fetch", fetchMock);
    const { service } = buildService({ app: buildCallbackApp(), saveVersion });

    const result = await service.handleOnlyOfficeCallback({
      documentId: "doc-1",
      token: "t",
      body: { status: 2, url: "https://office/save" }
    });

    expect(result).toEqual({ error: 0 });
    expect(fetchMock).toHaveBeenCalledWith("https://office/save");
    expect(saveVersion).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "doc-1", userId: "u-1", kind: "MANUAL" })
    );
    expect((saveVersion.mock.calls[0]![0] as { data: Buffer }).data).toBeInstanceOf(Buffer);
  });

  it("saves an AUTO version on status 6", async () => {
    const saveVersion = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)) })
    );
    const { service } = buildService({ app: buildCallbackApp(), saveVersion });

    await service.handleOnlyOfficeCallback({
      documentId: "doc-1",
      token: "t",
      body: { status: 6, url: "https://office/save" }
    });

    expect(saveVersion).toHaveBeenCalledWith(expect.objectContaining({ kind: "AUTO" }));
  });

  it("throws when the saved file cannot be downloaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const saveVersion = vi.fn();
    const { service } = buildService({ app: buildCallbackApp(), saveVersion });

    await expect(
      service.handleOnlyOfficeCallback({
        documentId: "doc-1",
        token: "t",
        body: { status: 2, url: "https://office/save" }
      })
    ).rejects.toThrow(/No se pudo descargar/);
    expect(saveVersion).not.toHaveBeenCalled();
  });
});

describe("DocumentOnlyOfficeService.forceSaveOnlyOffice", () => {
  const buildForceApp = () => ({
    prisma: {
      collaborativeDocumentVersion: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "v-1", versionNumber: 2, snapshotPath: "docs/doc-1/v2.docx" })
      }
    },
    storage: {},
    jwt: { sign: vi.fn().mockResolvedValue("signed") }
  });

  it("rejects unsupported document types", async () => {
    const { service } = buildService({ docType: "WHITEBOARD", app: buildForceApp() });
    await expect(
      service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" })
    ).rejects.toThrow(/ONLYOFFICE/);
  });

  it("rejects when there is no base version", async () => {
    const app = buildForceApp();
    app.prisma.collaborativeDocumentVersion.findFirst = vi.fn().mockResolvedValue(null);
    const { service } = buildService({ app });
    await expect(
      service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" })
    ).rejects.toThrow(/archivo base/);
  });

  it("returns saved=true when the command succeeds (error 0)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ error: 0 }) })
    );
    const { service } = buildService({ app: buildForceApp() });
    const result = await service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" });
    expect(result).toEqual({ saved: true, noChanges: false });
  });

  it("returns noChanges=true when the command reports error 4", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ error: 4 }) })
    );
    const { service } = buildService({ app: buildForceApp() });
    const result = await service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" });
    expect(result).toEqual({ saved: false, noChanges: true });
  });

  it("falls back to the legacy command endpoint on 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ error: 0 }) });
    vi.stubGlobal("fetch", fetchMock);
    const { service } = buildService({ app: buildForceApp() });

    const result = await service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" });

    expect(result.saved).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toContain("/command");
    expect(fetchMock.mock.calls[1]![0]).toContain("/coauthoring/CommandService.ashx");
  });

  it("throws when the command service responds with a non-404/405 error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { service } = buildService({ app: buildForceApp() });
    await expect(
      service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" })
    ).rejects.toThrow(/respondió con 500/);
  });

  it("throws when every command endpoint returns 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { service } = buildService({ app: buildForceApp() });
    await expect(
      service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" })
    ).rejects.toThrow(/no está disponible/);
  });

  it("throws when forcesave returns an unexpected error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ error: 1 }) })
    );
    const { service } = buildService({ app: buildForceApp() });
    await expect(
      service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" })
    ).rejects.toThrow(/falló con código 1/);
  });

  it("signs the command payload when ONLYOFFICE_JWT_SECRET is set", async () => {
    env.ONLYOFFICE_JWT_SECRET = "secret";
    const app = buildForceApp();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ error: 0 }) })
    );
    const { service } = buildService({ app });

    await service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" });

    expect(app.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ c: "forcesave" }),
      { key: "secret" }
    );
  });
});
