import { describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  env: {
    ONLYOFFICE_DOCUMENT_SERVER_URL: "",
    ONLYOFFICE_INTERNAL_URL: "",
    ONLYOFFICE_CALLBACK_BASE_URL: "",
    CORELIA_APP_URL: "http://localhost:3000",
    ONLYOFFICE_JWT_SECRET: ""
  }
}));

import { DocumentOnlyOfficeService } from "../modules/documents/document-onlyoffice-service.js";

type GetDocumentForUser = ConstructorParameters<typeof DocumentOnlyOfficeService>[1];
type SaveVersion = ConstructorParameters<typeof DocumentOnlyOfficeService>[2];

const buildService = (docType: string) => {
  const app = { prisma: {}, storage: {}, jwt: {} } as unknown as ConstructorParameters<
    typeof DocumentOnlyOfficeService
  >[0];
  const getDocumentForUser = vi
    .fn()
    .mockResolvedValue({ id: "doc-1", type: docType, name: "Doc", updatedAt: new Date() }) as unknown as GetDocumentForUser;
  const saveVersion = vi.fn().mockResolvedValue(undefined) as unknown as SaveVersion;
  return new DocumentOnlyOfficeService(app, getDocumentForUser, saveVersion);
};

describe("DocumentOnlyOfficeService", () => {
  it("rejects ONLYOFFICE config for non-supported document types", async () => {
    const service = buildService("DIAGRAMA");
    await expect(
      service.getOnlyOfficeConfig({ documentId: "doc-1", userId: "u-1", canEdit: true })
    ).rejects.toThrow(/texto, tabla y presentación/);
  });

  it("rejects forcesave for non-supported document types", async () => {
    const service = buildService("WHITEBOARD");
    await expect(service.forceSaveOnlyOffice({ documentId: "doc-1", userId: "u-1" })).rejects.toThrow(
      /ONLYOFFICE/
    );
  });
});
