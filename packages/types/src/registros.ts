import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

// ---------------- Empresa ----------------
export const empresaSchema = z.object({
  id: idSchema,
  codigo: z.number().int(),
  razonSocial: z.string().min(1).max(150),
  nombreFantasia: z.string().max(150).nullable(),
  direccion: z.string().max(150).nullable(),
  telefono: z.string().max(30).nullable(),
  fax: z.string().max(30).nullable(),
  localidad: z.string().max(40).nullable(),
  ruc: z.string().max(20).nullable(),
  dv: z.string().max(2).nullable(),
  nroInscripcionIps: z.string().max(20).nullable(),
  nroInscripcionBnt: z.string().max(20).nullable(),
  explotacion: z.string().max(40).nullable(),
  nombreContador: z.string().max(60).nullable(),
  rucContador: z.string().max(20).nullable(),
  nombreRepresentante: z.string().max(60).nullable(),
  rucRepresentante: z.string().max(20).nullable(),
  descripcionFactura: z.string().max(200).nullable(),
  urlReports: z.string().max(200).nullable(),
  logoUrl: z.string().max(300).nullable(),
  esExportador: z.boolean(),
  esExterna: z.boolean(),
  facturadorElectronico: z.boolean(),
  habilitada: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const empresaInputSchema = z.object({
  razonSocial: z.string().min(1).max(150),
  nombreFantasia: z.string().max(150).optional(),
  direccion: z.string().max(150).optional(),
  telefono: z.string().max(30).optional(),
  fax: z.string().max(30).optional(),
  localidad: z.string().max(40).optional(),
  ruc: z.string().max(20).optional(),
  dv: z.string().max(2).optional(),
  nroInscripcionIps: z.string().max(20).optional(),
  nroInscripcionBnt: z.string().max(20).optional(),
  explotacion: z.string().max(40).optional(),
  nombreContador: z.string().max(60).optional(),
  rucContador: z.string().max(20).optional(),
  nombreRepresentante: z.string().max(60).optional(),
  rucRepresentante: z.string().max(20).optional(),
  descripcionFactura: z.string().max(200).optional(),
  urlReports: z.string().max(200).optional(),
  logoUrl: z.string().max(300).optional(),
  esExportador: z.boolean().optional(),
  esExterna: z.boolean().optional(),
  facturadorElectronico: z.boolean().optional(),
  habilitada: z.boolean().optional()
});

// ---------------- Sucursal ----------------
export const sucursalSchema = z.object({
  id: idSchema,
  empresaId: idSchema,
  empresa: z.object({ id: idSchema, razonSocial: z.string() }).optional(),
  codigo: z.number().int(),
  descripcion: z.string().min(1).max(40),
  direccion: z.string().max(60).nullable(),
  telefono: z.string().max(30).nullable(),
  fax: z.string().max(30).nullable(),
  localidad: z.string().max(40).nullable(),
  departamento: z.string().max(40).nullable(),
  ruc: z.string().max(20).nullable(),
  abreviatura: z.string().max(4).nullable(),
  esCasaCentral: z.boolean(),
  logoUrl: z.string().max(300).nullable(),
  isActive: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const sucursalInputSchema = z.object({
  empresaId: idSchema,
  codigo: z.number().int().min(1).max(99),
  descripcion: z.string().min(1).max(40),
  direccion: z.string().max(60).optional(),
  telefono: z.string().max(30).optional(),
  fax: z.string().max(30).optional(),
  localidad: z.string().max(40).optional(),
  departamento: z.string().max(40).optional(),
  ruc: z.string().max(20).optional(),
  abreviatura: z.string().max(4).optional(),
  esCasaCentral: z.boolean().optional(),
  logoUrl: z.string().max(300).optional(),
  isActive: z.boolean().optional()
});

// ---------------- Pais ----------------
export const paisSchema = z.object({
  id: idSchema,
  codigo: z.number().int(),
  descripcion: z.string().min(1).max(60),
  nacionalidad: z.string().max(60).nullable()
});

export const paisInputSchema = z.object({
  codigo: z.number().int().min(1).max(999),
  descripcion: z.string().min(1).max(60),
  nacionalidad: z.string().max(60).optional()
});

// ---------------- Ciudad ----------------
export const ciudadSchema = z.object({
  id: idSchema,
  codigo: z.number().int(),
  descripcion: z.string().min(1).max(60),
  paisId: idSchema,
  pais: z.object({ id: idSchema, descripcion: z.string() }).optional()
});

export const ciudadInputSchema = z.object({
  codigo: z.number().int().min(1).max(99999),
  descripcion: z.string().min(1).max(60),
  paisId: idSchema
});

// ---------------- Sexo ----------------
export const sexoSchema = z.object({
  id: idSchema,
  codigo: z.string().min(1).max(1),
  descripcion: z.string().min(1).max(20)
});

export const sexoInputSchema = z.object({
  codigo: z.string().min(1).max(1),
  descripcion: z.string().min(1).max(20)
});

// ---------------- Persona ----------------
export const personaSchema = z.object({
  id: idSchema,
  codigo: z.number().int(),
  empresaId: idSchema,
  empresa: z.object({ id: idSchema, razonSocial: z.string() }).optional(),
  tipoDocumento: z.number().int(),
  ruc: z.string().min(1).max(15),
  dv: z.string().max(2).nullable(),
  razonSocial: z.string().min(1).max(150),
  nombreFantasia: z.string().max(150).nullable(),
  propietario: z.string().max(150).nullable(),
  direccion: z.string().min(1).max(400),
  localidad: z.string().max(40).nullable(),
  barrio: z.string().max(40).nullable(),
  paisId: idSchema.nullable(),
  pais: z.object({ id: idSchema, descripcion: z.string() }).optional(),
  ciudadId: idSchema.nullable(),
  ciudad: z.object({ id: idSchema, descripcion: z.string() }).optional(),
  sexoId: idSchema.nullable(),
  sexo: z.object({ id: idSchema, descripcion: z.string() }).optional(),
  telefono: z.string().min(1).max(45),
  celular: z.string().max(30).nullable(),
  email: z.string().max(50).nullable(),
  personaContacto: z.string().max(60).nullable(),
  fechaAniversario: timestampSchema.nullable(),
  esPep: z.boolean(),
  isActive: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const personaInputSchema = z.object({
  empresaId: idSchema,
  tipoDocumento: z.number().int().min(1).optional(),
  ruc: z.string().min(1).max(15),
  dv: z.string().max(2).optional(),
  razonSocial: z.string().min(1).max(150),
  nombreFantasia: z.string().max(150).optional(),
  propietario: z.string().max(150).optional(),
  direccion: z.string().min(1).max(400),
  localidad: z.string().max(40).optional(),
  barrio: z.string().max(40).optional(),
  paisId: idSchema.optional(),
  ciudadId: idSchema.optional(),
  sexoId: idSchema.optional(),
  telefono: z.string().min(1).max(45),
  celular: z.string().max(30).optional(),
  email: z.string().email().max(50).optional().or(z.literal("")),
  personaContacto: z.string().max(60).optional(),
  fechaAniversario: z.string().datetime().optional(),
  esPep: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export type Empresa = z.infer<typeof empresaSchema>;
export type EmpresaInput = z.infer<typeof empresaInputSchema>;
export type Sucursal = z.infer<typeof sucursalSchema>;
export type SucursalInput = z.infer<typeof sucursalInputSchema>;
export type Pais = z.infer<typeof paisSchema>;
export type PaisInput = z.infer<typeof paisInputSchema>;
export type Ciudad = z.infer<typeof ciudadSchema>;
export type CiudadInput = z.infer<typeof ciudadInputSchema>;
export type Sexo = z.infer<typeof sexoSchema>;
export type SexoInput = z.infer<typeof sexoInputSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type PersonaInput = z.infer<typeof personaInputSchema>;
