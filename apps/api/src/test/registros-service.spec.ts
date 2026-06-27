import { describe, expect, it, vi } from "vitest";
import { CiudadService, PaisService, PersonaService } from "../modules/registros/service.js";

type PaisApp = ConstructorParameters<typeof PaisService>[0];
type CiudadApp = ConstructorParameters<typeof CiudadService>[0];
type PersonaApp = ConstructorParameters<typeof PersonaService>[0];

describe("PaisService", () => {
  it("rejects a duplicate codigo", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "other", codigo: 600 });
    const app = { prisma: { pais: { findUnique } } } as unknown as PaisApp;
    const service = new PaisService(app);

    await expect(service.create({ codigo: 600, descripcion: "Paraguay" })).rejects.toThrow(
      /codigo/
    );
  });

  it("creates a pais when codigo is free", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: "p-1", codigo: 600 });
    const app = { prisma: { pais: { findUnique, create } } } as unknown as PaisApp;
    const service = new PaisService(app);

    await service.create({ codigo: 600, descripcion: "Paraguay", nacionalidad: "Paraguaya" });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ codigo: 600, nacionalidad: "Paraguaya" })
      })
    );
  });
});

describe("CiudadService", () => {
  it("rejects when the pais does not exist", async () => {
    const ciudadFind = vi.fn().mockResolvedValue(null);
    const paisFind = vi.fn().mockResolvedValue(null);
    const app = {
      prisma: { ciudad: { findUnique: ciudadFind }, pais: { findUnique: paisFind } }
    } as unknown as CiudadApp;
    const service = new CiudadService(app);

    await expect(
      service.create({ codigo: 1, descripcion: "Asunción", paisId: "missing" })
    ).rejects.toThrow(/pais/);
  });
});

describe("PersonaService", () => {
  it("rejects a duplicate ruc within the empresa", async () => {
    const empresaFind = vi.fn().mockResolvedValue({ id: "e-1" });
    const personaFind = vi.fn().mockResolvedValue({ id: "other" });
    const app = {
      prisma: {
        empresa: { findUnique: empresaFind },
        persona: { findUnique: personaFind }
      }
    } as unknown as PersonaApp;
    const service = new PersonaService(app);

    await expect(
      service.create(
        {
          empresaId: "e-1",
          ruc: "80012345-6",
          razonSocial: "ACME",
          direccion: "Centro",
          telefono: "021000"
        },
        "u-1"
      )
    ).rejects.toThrow(/RUC/);
  });

  it("sets createdById on creation", async () => {
    const empresaFind = vi.fn().mockResolvedValue({ id: "e-1" });
    const personaFind = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: "per-1" });
    const app = {
      prisma: {
        empresa: { findUnique: empresaFind },
        persona: { findUnique: personaFind, create }
      }
    } as unknown as PersonaApp;
    const service = new PersonaService(app);

    await service.create(
      {
        empresaId: "e-1",
        ruc: "80012345-6",
        razonSocial: "ACME",
        direccion: "Centro",
        telefono: "021000"
      },
      "u-1"
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: "u-1" }) })
    );
  });
});
