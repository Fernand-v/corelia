import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import type {
  CiudadInput,
  EmpresaInput,
  PaisInput,
  PersonaInput,
  SexoInput,
  SucursalInput
} from "@corelia/types";

// Quita claves undefined para no chocar con exactOptionalPropertyTypes de Prisma.
const stripUndefined = <T extends Record<string, unknown>>(obj: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

const validationError = (message: string) => {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
};

const notFoundError = (message: string) => {
  const error = new Error(message);
  error.name = "NotFoundError";
  return error;
};

const optional = <T>(value: T | undefined, fallback: T | null = null) =>
  value === undefined ? fallback : value;

// Tope defensivo para listados sin paginación (evita cargar tablas enteras a RAM).
const LIST_LIMIT = 200;

export class EmpresaService {
  constructor(private readonly app: FastifyInstance) {}

  list() {
    return this.app.prisma.empresa.findMany({ orderBy: { razonSocial: "asc" }, take: LIST_LIMIT });
  }

  async get(id: string) {
    const empresa = await this.app.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) throw notFoundError("Empresa no encontrada");
    return empresa;
  }

  create(input: EmpresaInput) {
    return this.app.prisma.empresa.create({
      data: stripUndefined(input) as Prisma.EmpresaUncheckedCreateInput
    });
  }

  async update(id: string, input: EmpresaInput) {
    await this.get(id);
    return this.app.prisma.empresa.update({
      where: { id },
      data: stripUndefined(input) as Prisma.EmpresaUncheckedUpdateInput
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.app.prisma.empresa.delete({ where: { id } });
  }
}

export class PaisService {
  constructor(private readonly app: FastifyInstance) {}

  list() {
    return this.app.prisma.pais.findMany({ orderBy: { descripcion: "asc" } });
  }

  async get(id: string) {
    const pais = await this.app.prisma.pais.findUnique({ where: { id } });
    if (!pais) throw notFoundError("Pais no encontrado");
    return pais;
  }

  async create(input: PaisInput) {
    await this.ensureCodigoLibre(input.codigo);
    return this.app.prisma.pais.create({
      data: {
        codigo: input.codigo,
        descripcion: input.descripcion,
        nacionalidad: optional(input.nacionalidad)
      }
    });
  }

  async update(id: string, input: PaisInput) {
    await this.get(id);
    await this.ensureCodigoLibre(input.codigo, id);
    return this.app.prisma.pais.update({
      where: { id },
      data: {
        codigo: input.codigo,
        descripcion: input.descripcion,
        nacionalidad: optional(input.nacionalidad)
      }
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.app.prisma.pais.delete({ where: { id } });
  }

  private async ensureCodigoLibre(codigo: number, excludeId?: string) {
    const existing = await this.app.prisma.pais.findUnique({ where: { codigo } });
    if (existing && existing.id !== excludeId) {
      throw validationError("Ya existe un pais con ese codigo");
    }
  }
}

export class CiudadService {
  constructor(private readonly app: FastifyInstance) {}

  list() {
    return this.app.prisma.ciudad.findMany({
      include: { pais: { select: { id: true, descripcion: true } } },
      orderBy: { descripcion: "asc" },
      take: LIST_LIMIT
    });
  }

  async get(id: string) {
    const ciudad = await this.app.prisma.ciudad.findUnique({
      where: { id },
      include: { pais: { select: { id: true, descripcion: true } } }
    });
    if (!ciudad) throw notFoundError("Ciudad no encontrada");
    return ciudad;
  }

  async create(input: CiudadInput) {
    await this.ensureCodigoLibre(input.codigo);
    await this.ensurePais(input.paisId);
    return this.app.prisma.ciudad.create({
      data: { codigo: input.codigo, descripcion: input.descripcion, paisId: input.paisId },
      include: { pais: { select: { id: true, descripcion: true } } }
    });
  }

  async update(id: string, input: CiudadInput) {
    await this.get(id);
    await this.ensureCodigoLibre(input.codigo, id);
    await this.ensurePais(input.paisId);
    return this.app.prisma.ciudad.update({
      where: { id },
      data: { codigo: input.codigo, descripcion: input.descripcion, paisId: input.paisId },
      include: { pais: { select: { id: true, descripcion: true } } }
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.app.prisma.ciudad.delete({ where: { id } });
  }

  private async ensureCodigoLibre(codigo: number, excludeId?: string) {
    const existing = await this.app.prisma.ciudad.findUnique({ where: { codigo } });
    if (existing && existing.id !== excludeId) {
      throw validationError("Ya existe una ciudad con ese codigo");
    }
  }

  private async ensurePais(paisId: string) {
    const pais = await this.app.prisma.pais.findUnique({ where: { id: paisId }, select: { id: true } });
    if (!pais) throw validationError("El pais indicado no existe");
  }
}

export class SexoService {
  constructor(private readonly app: FastifyInstance) {}

  list() {
    return this.app.prisma.sexo.findMany({ orderBy: { codigo: "asc" } });
  }

  async get(id: string) {
    const sexo = await this.app.prisma.sexo.findUnique({ where: { id } });
    if (!sexo) throw notFoundError("Sexo no encontrado");
    return sexo;
  }

  async create(input: SexoInput) {
    await this.ensureCodigoLibre(input.codigo);
    return this.app.prisma.sexo.create({
      data: { codigo: input.codigo.toUpperCase(), descripcion: input.descripcion }
    });
  }

  async update(id: string, input: SexoInput) {
    await this.get(id);
    await this.ensureCodigoLibre(input.codigo, id);
    return this.app.prisma.sexo.update({
      where: { id },
      data: { codigo: input.codigo.toUpperCase(), descripcion: input.descripcion }
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.app.prisma.sexo.delete({ where: { id } });
  }

  private async ensureCodigoLibre(codigo: string, excludeId?: string) {
    const existing = await this.app.prisma.sexo.findUnique({
      where: { codigo: codigo.toUpperCase() }
    });
    if (existing && existing.id !== excludeId) {
      throw validationError("Ya existe un sexo con ese codigo");
    }
  }
}

const personaInclude = {
  empresa: { select: { id: true, razonSocial: true } },
  tipoDocumento: { select: { id: true, descripcion: true } },
  pais: { select: { id: true, descripcion: true } },
  ciudad: { select: { id: true, descripcion: true } },
  sexo: { select: { id: true, descripcion: true } }
} as const;

export class PersonaService {
  constructor(private readonly app: FastifyInstance) {}

  list() {
    return this.app.prisma.persona.findMany({
      include: personaInclude,
      orderBy: { razonSocial: "asc" },
      take: LIST_LIMIT
    });
  }

  async get(id: string) {
    const persona = await this.app.prisma.persona.findUnique({
      where: { id },
      include: personaInclude
    });
    if (!persona) throw notFoundError("Persona no encontrada");
    return persona;
  }

  async create(input: PersonaInput, createdById: string) {
    await this.ensureRelations(input);
    await this.ensureRucLibre(input.empresaId, input.ruc);
    return this.app.prisma.persona.create({
      data: { ...this.buildData(input), createdById },
      include: personaInclude
    });
  }

  async update(id: string, input: PersonaInput) {
    await this.get(id);
    await this.ensureRelations(input);
    await this.ensureRucLibre(input.empresaId, input.ruc, id);
    return this.app.prisma.persona.update({
      where: { id },
      data: this.buildData(input),
      include: personaInclude
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.app.prisma.persona.delete({ where: { id } });
  }

  private buildData(input: PersonaInput) {
    const email = input.email ? input.email : null;
    return {
      empresaId: input.empresaId,
      tipoDocumentoId: optional(input.tipoDocumentoId),
      ruc: input.ruc,
      dv: optional(input.dv),
      razonSocial: input.razonSocial,
      nombreFantasia: optional(input.nombreFantasia),
      propietario: optional(input.propietario),
      direccion: input.direccion,
      barrio: optional(input.barrio),
      paisId: optional(input.paisId),
      ciudadId: optional(input.ciudadId),
      sexoId: optional(input.sexoId),
      telefono: input.telefono,
      celular: optional(input.celular),
      email,
      personaContacto: optional(input.personaContacto),
      fechaAniversario: input.fechaAniversario ? new Date(input.fechaAniversario) : null,
      ...(input.esPep !== undefined ? { esPep: input.esPep } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
    };
  }

  private async ensureRucLibre(empresaId: string, ruc: string, excludeId?: string) {
    const existing = await this.app.prisma.persona.findUnique({
      where: { empresaId_ruc: { empresaId, ruc } }
    });
    if (existing && existing.id !== excludeId) {
      throw validationError("Ya existe una persona con ese RUC en la empresa");
    }
  }

  private async ensureRelations(input: PersonaInput) {
    const empresa = await this.app.prisma.empresa.findUnique({
      where: { id: input.empresaId },
      select: { id: true }
    });
    if (!empresa) throw validationError("La empresa indicada no existe");

    if (input.tipoDocumentoId) {
      const tipoDocumento = await this.app.prisma.tipoDocumento.findUnique({
        where: { id: input.tipoDocumentoId },
        select: { id: true }
      });
      if (!tipoDocumento) throw validationError("El tipo de documento indicado no existe");
    }
    if (input.paisId) {
      const pais = await this.app.prisma.pais.findUnique({
        where: { id: input.paisId },
        select: { id: true }
      });
      if (!pais) throw validationError("El pais indicado no existe");
    }
    if (input.ciudadId) {
      const ciudad = await this.app.prisma.ciudad.findUnique({
        where: { id: input.ciudadId },
        select: { id: true }
      });
      if (!ciudad) throw validationError("La ciudad indicada no existe");
    }
    if (input.sexoId) {
      const sexo = await this.app.prisma.sexo.findUnique({
        where: { id: input.sexoId },
        select: { id: true }
      });
      if (!sexo) throw validationError("El sexo indicado no existe");
    }
  }
}

const sucursalInclude = {
  empresa: { select: { id: true, razonSocial: true } }
} as const;

export class SucursalService {
  constructor(private readonly app: FastifyInstance) {}

  list() {
    return this.app.prisma.sucursal.findMany({
      include: sucursalInclude,
      orderBy: [{ empresaId: "asc" }, { codigo: "asc" }],
      take: LIST_LIMIT
    });
  }

  async get(id: string) {
    const sucursal = await this.app.prisma.sucursal.findUnique({
      where: { id },
      include: sucursalInclude
    });
    if (!sucursal) throw notFoundError("Sucursal no encontrada");
    return sucursal;
  }

  async create(input: SucursalInput) {
    await this.ensureEmpresa(input.empresaId);
    await this.ensureCodigoLibre(input.empresaId, input.codigo);
    return this.app.prisma.sucursal.create({
      data: stripUndefined(input) as Prisma.SucursalUncheckedCreateInput,
      include: sucursalInclude
    });
  }

  async update(id: string, input: SucursalInput) {
    await this.get(id);
    await this.ensureEmpresa(input.empresaId);
    await this.ensureCodigoLibre(input.empresaId, input.codigo, id);
    return this.app.prisma.sucursal.update({
      where: { id },
      data: stripUndefined(input) as Prisma.SucursalUncheckedUpdateInput,
      include: sucursalInclude
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.app.prisma.sucursal.delete({ where: { id } });
  }

  private async ensureEmpresa(empresaId: string) {
    const empresa = await this.app.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true }
    });
    if (!empresa) throw validationError("La empresa indicada no existe");
  }

  private async ensureCodigoLibre(empresaId: string, codigo: number, excludeId?: string) {
    const existing = await this.app.prisma.sucursal.findUnique({
      where: { empresaId_codigo: { empresaId, codigo } }
    });
    if (existing && existing.id !== excludeId) {
      throw validationError("Ya existe una sucursal con ese codigo en la empresa");
    }
  }
}
