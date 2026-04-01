import { z } from "zod";
import { idSchema } from "./common.js";
import {
  RBAC_PROGRAMS,
  RBAC_PERMISSION_CATEGORIES,
  RBAC_PERMISSIONS,
  RBAC_ROLE_PERMISSION_MATRIX,
  RBAC_SYSTEM_ROLES
} from "./rbac-catalog.js";

const categoryCodes = RBAC_PERMISSION_CATEGORIES.map((category) => category.code) as [
  (typeof RBAC_PERMISSION_CATEGORIES)[number]["code"],
  ...(typeof RBAC_PERMISSION_CATEGORIES)[number]["code"][]
];

const systemProgramCodes = RBAC_PROGRAMS.map((program) => program.code) as [
  (typeof RBAC_PROGRAMS)[number]["code"],
  ...(typeof RBAC_PROGRAMS)[number]["code"][]
];

const systemRoleCodes = RBAC_SYSTEM_ROLES.map((role) => role.code) as [
  (typeof RBAC_SYSTEM_ROLES)[number]["code"],
  ...(typeof RBAC_SYSTEM_ROLES)[number]["code"][]
];

export const permissionSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Formato de permiso inválido");
export const permissionCategoryCodeSchema = z.enum(categoryCodes);
export const systemProgramCodeSchema = z.enum(systemProgramCodes);
export const programCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Formato de programa inválido");
export const systemRoleCodeSchema = z.enum(systemRoleCodes);
export const roleCodeSchema = systemRoleCodeSchema.or(z.string().min(3).max(120));
export const roleScopeSchema = z.enum(["GLOBAL", "PROJECT"]);

export const programSchema = z.object({
  id: idSchema,
  code: z.number().int().min(1),
  key: programCodeSchema,
  displayName: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  sortOrder: z.number().int().min(0),
  isSystem: z.boolean(),
  isActive: z.boolean()
});

export const permissionCategorySchema = z.object({
  id: idSchema,
  code: z.number().int().min(1),
  key: permissionCategoryCodeSchema,
  displayName: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  sortOrder: z.number().int().min(0)
});

export const permissionItemSchema = z.object({
  id: idSchema,
  code: z.number().int().min(1),
  key: permissionSchema,
  displayName: z.string().min(1).max(160),
  description: z.string().max(500).nullable(),
  programId: idSchema,
  categoryId: idSchema,
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
  program: programSchema.optional(),
  category: permissionCategorySchema.optional()
});

export const roleSchema = z.object({
  id: idSchema,
  code: z.number().int().min(1),
  key: z.string().min(3).max(120),
  displayName: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  isSystem: z.boolean(),
  scope: roleScopeSchema,
  rank: z.number().int().min(0)
});

export const roleWithPermissionsSchema = roleSchema.extend({
  programs: z.array(programSchema).default([]),
  permissions: z.array(permissionItemSchema)
});

export const rolePermissionsUpdateSchema = z.object({
  permissionCodes: z.array(permissionSchema).default([])
});

export const roleContextInputSchema = z.object({
  userId: idSchema,
  projectId: idSchema.optional()
});

export const activeRoleSchema = z.object({
  userId: idSchema,
  projectId: idSchema.nullable(),
  roleId: idSchema,
  role: z.string().min(3).max(120),
  programs: z.array(programCodeSchema).default([]),
  permissions: z.array(permissionSchema)
});

export type Permission = z.infer<typeof permissionSchema>;
export type PermissionCategoryCode = z.infer<typeof permissionCategoryCodeSchema>;
export type ProgramCode = z.infer<typeof programCodeSchema>;
export type SystemProgramCode = z.infer<typeof systemProgramCodeSchema>;
export type SystemRoleCode = z.infer<typeof systemRoleCodeSchema>;
export type RoleCode = z.infer<typeof roleCodeSchema>;
export type RoleScope = z.infer<typeof roleScopeSchema>;
export type ActiveRole = z.infer<typeof activeRoleSchema>;

export {
  RBAC_PROGRAMS,
  RBAC_PERMISSION_CATEGORIES,
  RBAC_PERMISSIONS,
  RBAC_ROLE_PERMISSION_MATRIX,
  RBAC_SYSTEM_ROLES
};
