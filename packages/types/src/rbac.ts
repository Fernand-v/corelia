import { z } from "zod";
import { idSchema } from "./common.js";
import {
  RBAC_PROGRAMS,
  RBAC_PERMISSION_CATEGORIES,
  RBAC_PERMISSIONS,
  RBAC_PERMISSIONS_ENRICHED,
  RBAC_ROLE_PERMISSION_MATRIX,
  RBAC_SYSTEM_ROLES,
  RBAC_ACTIONS,
  RBAC_RESOURCES,
  permissionKey,
  splitPermissionKey
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

const systemActionCodes = RBAC_ACTIONS.map((action) => action.code) as [
  (typeof RBAC_ACTIONS)[number]["code"],
  ...(typeof RBAC_ACTIONS)[number]["code"][]
];

const systemResourceCodes = RBAC_RESOURCES.map((resource) => resource.code) as [
  (typeof RBAC_RESOURCES)[number]["code"],
  ...(typeof RBAC_RESOURCES)[number]["code"][]
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

export const actionCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Formato de acción inválido");
export const resourceCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Formato de recurso inválido");
export const systemActionCodeSchema = z.enum(systemActionCodes);
export const systemResourceCodeSchema = z.enum(systemResourceCodes);

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
  resource: resourceCodeSchema,
  action: actionCodeSchema,
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
export type ActionCode = z.infer<typeof actionCodeSchema>;
export type ResourceCode = z.infer<typeof resourceCodeSchema>;
export type SystemActionCode = z.infer<typeof systemActionCodeSchema>;
export type SystemResourceCode = z.infer<typeof systemResourceCodeSchema>;

export {
  RBAC_PROGRAMS,
  RBAC_PERMISSION_CATEGORIES,
  RBAC_PERMISSIONS,
  RBAC_PERMISSIONS_ENRICHED,
  RBAC_ROLE_PERMISSION_MATRIX,
  RBAC_SYSTEM_ROLES,
  RBAC_ACTIONS,
  RBAC_RESOURCES,
  permissionKey,
  splitPermissionKey
};
