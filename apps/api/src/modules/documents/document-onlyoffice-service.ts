import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import type { DocumentVersionKind } from "@corelia/types";
import { env } from "../../config/env.js";
import {
  buildOnlyOfficeDocumentKey,
  getOnlyOfficeFileInfo,
  getOnlyOfficeFileName,
  inferOnlyOfficeFileNameFromPath,
  inferOnlyOfficeMimeType,
  isOnlyOfficeDocumentType
} from "./onlyoffice.js";

const ONLYOFFICE_FILE_TOKEN_TYPE = "onlyoffice_file";
const ONLYOFFICE_CALLBACK_TOKEN_TYPE = "onlyoffice_callback";
const ONLYOFFICE_LINK_TOKEN_TTL = "7d";

type CollabDocument = Prisma.CollaborativeDocumentGetPayload<{
  include: { createdBy: { select: { firstName: true; lastName: true } } };
}>;

type SaveVersion = (input: {
  documentId: string;
  userId: string;
  kind: DocumentVersionKind;
  fileName: string;
  mimeType: string;
  data: Buffer;
}) => Promise<unknown>;

// Sub-servicio de integración ONLYOFFICE (config del editor, contenido de
// archivo, callback de guardado y forcesave), extraído de DocumentsService.
// Recibe getDocumentForUser y saveVersion por inyección para reutilizar el
// control de acceso y la creación de versiones del servicio principal.
export class DocumentOnlyOfficeService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly getDocumentForUser: (input: {
      documentId: string;
      userId: string;
    }) => Promise<CollabDocument>,
    private readonly saveVersion: SaveVersion
  ) {}

  private getOnlyOfficeDocumentServerUrl() {
    const value = env.ONLYOFFICE_DOCUMENT_SERVER_URL.trim();
    if (value) {
      return value.replace(/\/+$/g, "");
    }
    return "/onlyoffice";
  }

  /** URL interna (Docker) usada para llamadas server-side a la Command API de OnlyOffice */
  private getOnlyOfficeInternalUrl() {
    const configured = env.ONLYOFFICE_INTERNAL_URL.trim();
    if (configured) {
      return configured.replace(/\/+$/g, "");
    }
    // Fallback: si hay URL pública configurada, usarla también para comandos internos
    const pub = env.ONLYOFFICE_DOCUMENT_SERVER_URL.trim();
    if (pub) {
      return pub.replace(/\/+$/g, "");
    }
    return "http://onlyoffice";
  }

  private getOnlyOfficeApiBaseUrl() {
    const configured = env.ONLYOFFICE_CALLBACK_BASE_URL.trim();
    const base = (configured || env.CORELIA_APP_URL).replace(/\/+$/g, "");
    return `${base}/api/v1`;
  }

  /**
   * Hosts permitidos para descargar el archivo guardado por ONLYOFFICE.
   * Derivados de la config del servidor (interno/público). Mitiga SSRF: el
   * callback no debe descargar URLs arbitrarias del body.
   */
  private getAllowedOnlyOfficeHosts(): Set<string> {
    const hosts = new Set<string>();
    for (const raw of [env.ONLYOFFICE_INTERNAL_URL, env.ONLYOFFICE_DOCUMENT_SERVER_URL]) {
      const value = raw.trim();
      if (!value || !/^https?:\/\//i.test(value)) {
        continue;
      }
      try {
        hosts.add(new URL(value).host.toLowerCase());
      } catch {
        // URL inválida en config → se ignora.
      }
    }
    return hosts;
  }

  private assertAllowedDownloadUrl(rawUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error("URL de archivo de ONLYOFFICE inválida");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL de archivo de ONLYOFFICE inválida");
    }
    const allowed = this.getAllowedOnlyOfficeHosts();
    // Si hay hosts configurados, exigir coincidencia; si no, no se puede validar.
    if (allowed.size > 0 && !allowed.has(parsed.host.toLowerCase())) {
      throw new Error("URL de archivo de ONLYOFFICE no permitida");
    }
  }

  private async signOnlyOfficeFileToken(input: {
    documentId: string;
    userId: string;
    fileName: string;
    mimeType: string;
    snapshotPath: string;
  }) {
    return this.app.jwt.sign(
      {
        typ: ONLYOFFICE_FILE_TOKEN_TYPE,
        documentId: input.documentId,
        userId: input.userId,
        snapshotPath: input.snapshotPath,
        fileName: input.fileName,
        mimeType: input.mimeType
      },
      {
        expiresIn: ONLYOFFICE_LINK_TOKEN_TTL
      }
    );
  }

  private async signOnlyOfficeCallbackToken(input: {
    documentId: string;
    userId: string;
  }) {
    return this.app.jwt.sign(
      {
        typ: ONLYOFFICE_CALLBACK_TOKEN_TYPE,
        documentId: input.documentId,
        userId: input.userId
      },
      {
        expiresIn: ONLYOFFICE_LINK_TOKEN_TTL
      }
    );
  }

  private async resolveOnlyOfficeLatestVersion(documentId: string) {
    return this.app.prisma.collaborativeDocumentVersion.findFirst({
      where: {
        documentId
      },
      orderBy: {
        versionNumber: "desc"
      },
      select: {
        id: true,
        versionNumber: true,
        snapshotPath: true
      }
    });
  }

  async getOnlyOfficeConfig(input: {
    documentId: string;
    userId: string;
    canEdit: boolean;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    if (!isOnlyOfficeDocumentType(document.type)) {
      throw new Error("ONLYOFFICE está disponible solo para texto, tabla y presentación");
    }

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const documentServerUrl = this.getOnlyOfficeDocumentServerUrl();
    if (!documentServerUrl) {
      throw new Error("ONLYOFFICE no está configurado");
    }

    const latestVersion = await this.resolveOnlyOfficeLatestVersion(document.id);
    if (!latestVersion) {
      throw new Error("El documento no tiene archivo base para abrir en ONLYOFFICE");
    }

    const user = await this.app.prisma.user.findUnique({
      where: {
        id: input.userId
      },
      select: {
        firstName: true,
        lastName: true,
        email: true
      }
    });

    const userName =
      user ? `${user.firstName} ${user.lastName}`.trim() || user.email : `Usuario ${input.userId}`;
    const fileInfo = getOnlyOfficeFileInfo(document.type);
    const fileName = inferOnlyOfficeFileNameFromPath(
      latestVersion.snapshotPath,
      getOnlyOfficeFileName(document.name, document.type),
      document.type
    );
    const mimeType = inferOnlyOfficeMimeType(latestVersion.snapshotPath, document.type);
    const apiBaseUrl = this.getOnlyOfficeApiBaseUrl();
    const fileToken = await this.signOnlyOfficeFileToken({
      documentId: document.id,
      userId: input.userId,
      fileName,
      mimeType,
      snapshotPath: latestVersion.snapshotPath
    });
    const callbackToken = await this.signOnlyOfficeCallbackToken({
      documentId: document.id,
      userId: input.userId
    });

    const config = {
      documentType: fileInfo.documentType,
      type: "desktop",
      document: {
        fileType: fileInfo.fileType,
        key: buildOnlyOfficeDocumentKey({
          documentId: document.id,
          currentVersion: latestVersion.versionNumber,
          updatedAt: document.updatedAt.toISOString()
        }),
        title: fileName,
        url: `${apiBaseUrl}/documents/${encodeURIComponent(document.id)}/onlyoffice/file?token=${encodeURIComponent(fileToken)}`,
        permissions: {
          edit: input.canEdit,
          download: true,
          print: true,
          copy: true,
          review: input.canEdit
        }
      },
      editorConfig: {
        mode: input.canEdit ? "edit" : "view",
        lang: "es",
        callbackUrl: `${apiBaseUrl}/documents/${encodeURIComponent(document.id)}/onlyoffice/callback?token=${encodeURIComponent(callbackToken)}`,
        user: {
          id: input.userId,
          name: userName
        },
        region: "es",
        customization: {
          autosave: true,
          forcesave: true,
          spellcheck: true,
          compactHeader: false,
          toolbarNoTabs: false
        }
      }
    } as Record<string, unknown>;

    if (env.ONLYOFFICE_JWT_SECRET) {
      return {
        documentServerUrl,
        config: {
          ...config,
          token: await this.app.jwt.sign(config, {
            key: env.ONLYOFFICE_JWT_SECRET
          })
        }
      };
    }

    return {
      documentServerUrl,
      config
    };
  }

  async getOnlyOfficeFileContent(input: { documentId: string; token: string }) {
    const payload = (await this.app.jwt.verify(input.token)) as Partial<{
      typ: string;
      documentId: string;
      snapshotPath: string;
      fileName: string;
      mimeType: string;
    }>;

    if (
      payload.typ !== ONLYOFFICE_FILE_TOKEN_TYPE ||
      payload.documentId !== input.documentId ||
      !payload.documentId ||
      !payload.snapshotPath ||
      !payload.fileName ||
      !payload.mimeType
    ) {
      throw new Error("Token de ONLYOFFICE inválido");
    }

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const stream = await this.app.storage.getObjectStream(payload.snapshotPath);
    return {
      stream,
      fileName: payload.fileName,
      mimeType: payload.mimeType
    };
  }

  async handleOnlyOfficeCallback(input: {
    documentId: string;
    token: string;
    body: {
      status: number;
      url?: string;
    };
  }) {
    const tokenPayload = (await this.app.jwt.verify(input.token)) as Partial<{
      typ: string;
      documentId: string;
      userId: string;
    }>;

    if (
      tokenPayload.typ !== ONLYOFFICE_CALLBACK_TOKEN_TYPE ||
      tokenPayload.documentId !== input.documentId ||
      !tokenPayload.userId
    ) {
      throw new Error("Callback de ONLYOFFICE inválido");
    }

    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: tokenPayload.userId
    });

    if (!isOnlyOfficeDocumentType(document.type)) {
      throw new Error("Tipo de documento no soportado por ONLYOFFICE");
    }

    const status = Number(input.body.status);
    if (![2, 3, 6, 7].includes(status)) {
      return { error: 0 as const };
    }

    if (status === 3 || status === 7) {
      return { error: 0 as const };
    }

    if (!input.body.url) {
      throw new Error("ONLYOFFICE no envió la URL del archivo");
    }

    this.assertAllowedDownloadUrl(input.body.url);

    const response = await fetch(input.body.url);
    if (!response.ok) {
      throw new Error("No se pudo descargar el archivo guardado por ONLYOFFICE");
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileInfo = getOnlyOfficeFileInfo(document.type);
    await this.saveVersion({
      documentId: document.id,
      userId: tokenPayload.userId,
      kind: status === 6 ? "AUTO" : "MANUAL",
      fileName: getOnlyOfficeFileName(document.name, document.type),
      mimeType: fileInfo.mimeType,
      data: Buffer.from(arrayBuffer)
    });

    return { error: 0 as const };
  }

  async forceSaveOnlyOffice(input: {
    documentId: string;
    userId: string;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    if (!isOnlyOfficeDocumentType(document.type)) {
      throw new Error("Forcesave solo está disponible para documentos de ONLYOFFICE");
    }

    const internalUrl = this.getOnlyOfficeInternalUrl();

    const latestVersion = await this.resolveOnlyOfficeLatestVersion(document.id);
    if (!latestVersion) {
      throw new Error("El documento no tiene archivo base");
    }

    const documentKey = buildOnlyOfficeDocumentKey({
      documentId: document.id,
      currentVersion: latestVersion.versionNumber,
      updatedAt: document.updatedAt.toISOString()
    });

    const commandPayload: Record<string, unknown> = {
      c: "forcesave",
      key: documentKey
    };

    if (env.ONLYOFFICE_JWT_SECRET) {
      commandPayload.token = await this.app.jwt.sign(commandPayload, {
        key: env.ONLYOFFICE_JWT_SECRET
      });
    }

    const commandUrls = [
      `${internalUrl}/command`,
      `${internalUrl}/coauthoring/CommandService.ashx`
    ];
    let response: Response | null = null;

    for (const commandUrl of commandUrls) {
      const currentResponse = await fetch(commandUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commandPayload)
      });

      if (currentResponse.ok) {
        response = currentResponse;
        break;
      }

      if (currentResponse.status !== 404 && currentResponse.status !== 405) {
        throw new Error(`ONLYOFFICE Command Service respondió con ${currentResponse.status}`);
      }
    }

    if (!response) {
      throw new Error("ONLYOFFICE Command Service no está disponible en /command ni en /coauthoring/CommandService.ashx");
    }

    const result = (await response.json()) as { error?: number };

    // error 0 = OK, error 4 = no changes (documento sin modificar)
    if (result.error !== 0 && result.error !== 4) {
      throw new Error(`ONLYOFFICE forcesave falló con código ${result.error}`);
    }

    return {
      saved: result.error === 0,
      noChanges: result.error === 4
    };
  }
}
