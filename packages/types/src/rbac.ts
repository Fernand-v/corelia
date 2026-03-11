import { z } from "zod";
import { idSchema } from "./common.js";
import {
  RBAC_PERMISSION_CATEGORIES,
  RBAC_PERMISSIONS,
  RBAC_ROLE_PERMISSION_MATRIX,
  RBAC_SYSTEM_ROLES
} from "./rbac-catalog.js";

const permissionCodes = RBAC_PERMISSIONS.map((permission) => permission.code) as [
  (typeof RBAC_PERMISSIONS)[number]["code"],
  ...(typeof RBAC_PERMISSIONS)[number]["code"][]
];

const categoryCodes = RBAC_PERMISSION_CATEGORIES.map((category) => category.code) as [
  (typeof RBAC_PERMISSION_CATEGORIES)[number]["code"],
  ...(typeof RBAC_PERMISSION_CATEGORIES)[number]["code"][]
];

const systemRoleCodes = RBAC_SYSTEM_ROLES.map((role) => role.code) as [
  (typeof RBAC_SYSTEM_ROLES)[number]["code"],
  ...(typeof RBAC_SYSTEM_ROLES)[number]["code"][]
];

export const permissionSchema = z.enum(permissionCodes);
export const permissionCategoryCodeSchema = z.enum(categoryCodes);
export const systemRoleCodeSchema = z.enum(systemRoleCodes);
export const roleCodeSchema = systemRoleCodeSchema.or(z.string().min(3).max(120));
export const roleScopeSchema = z.enum(["GLOBAL", "PROJECT"]);

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
  categoryId: idSchema,
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
  permissions: z.array(permissionSchema)
});

export type Permission = z.infer<typeof permissionSchema>;
export type PermissionCategoryCode = z.infer<typeof permissionCategoryCodeSchema>;
export type SystemRoleCode = z.infer<typeof systemRoleCodeSchema>;
export type RoleCode = z.infer<typeof roleCodeSchema>;
export type RoleScope = z.infer<typeof roleScopeSchema>;
export type ActiveRole = z.infer<typeof activeRoleSchema>;

export {
  RBAC_PERMISSION_CATEGORIES,
  RBAC_PERMISSIONS,
  RBAC_ROLE_PERMISSION_MATRIX,
  RBAC_SYSTEM_ROLES
};
