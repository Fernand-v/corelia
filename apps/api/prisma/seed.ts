import { PrismaClient } from "@prisma/client";
import {
  RBAC_PERMISSION_CATEGORIES,
  RBAC_PERMISSIONS,
  RBAC_ROLE_PERMISSION_MATRIX,
  RBAC_SYSTEM_ROLES
} from "@corelia/types";

const prisma = new PrismaClient();

async function main() {
  for (const [index, category] of RBAC_PERMISSION_CATEGORIES.entries()) {
    await prisma.permissionCategory.upsert({
      where: { key: category.code },
      update: {
        code: index + 1,
        key: category.code,
        displayName: category.displayName,
        description: category.description,
        sortOrder: category.sortOrder
      },
      create: {
        code: index + 1,
        key: category.code,
        displayName: category.displayName,
        description: category.description,
        sortOrder: category.sortOrder
      }
    });
  }

  const categories = await prisma.permissionCategory.findMany({
    select: {
      id: true,
      key: true
    }
  });
  const categoryIdByKey = new Map(categories.map((category) => [category.key, category.id]));

  for (const [index, permission] of RBAC_PERMISSIONS.entries()) {
    const categoryId = categoryIdByKey.get(permission.categoryCode);
    if (!categoryId) {
      throw new Error(`Categoria de permiso no encontrada: ${permission.categoryCode}`);
    }

    await prisma.permission.upsert({
      where: { key: permission.code },
      update: {
        code: index + 1,
        key: permission.code,
        displayName: permission.displayName,
        description: permission.description,
        categoryId
      },
      create: {
        code: index + 1,
        key: permission.code,
        displayName: permission.displayName,
        description: permission.description,
        categoryId
      }
    });
  }

  for (const [index, role] of RBAC_SYSTEM_ROLES.entries()) {
    await prisma.role.upsert({
      where: { key: role.code },
      update: {
        code: index + 1,
        key: role.code,
        displayName: role.displayName,
        description: role.description,
        isSystem: true,
        scope: role.scope,
        rank: role.rank
      },
      create: {
        code: index + 1,
        key: role.code,
        displayName: role.displayName,
        description: role.description,
        isSystem: true,
        scope: role.scope,
        rank: role.rank
      }
    });
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: {
        key: {
          in: RBAC_SYSTEM_ROLES.map((role) => role.code)
        }
      },
      select: {
        id: true,
        key: true
      }
    }),
    prisma.permission.findMany({
      where: {
        key: {
          in: RBAC_PERMISSIONS.map((permission) => permission.code)
        }
      },
      select: {
        id: true,
        key: true
      }
    })
  ]);

  const roleIdByKey = new Map(roles.map((role) => [role.key, role.id]));
  const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  for (const role of RBAC_SYSTEM_ROLES) {
    const roleId = roleIdByKey.get(role.code);
    if (!roleId) {
      throw new Error(`Rol de sistema no encontrado: ${role.code}`);
    }

    const permissionCodes = RBAC_ROLE_PERMISSION_MATRIX[role.code] ?? [];

    await prisma.rolePermission.deleteMany({
      where: {
        roleId
      }
    });

    if (permissionCodes.length === 0) {
      continue;
    }

    const rolePermissionRows = permissionCodes.map((permissionCode) => {
      const permissionId = permissionIdByKey.get(permissionCode);
      if (!permissionId) {
        throw new Error(`Permiso no encontrado para role matrix: ${permissionCode}`);
      }

      return {
        roleId,
        permissionId
      };
    });

    await prisma.rolePermission.createMany({
      data: rolePermissionRows,
      skipDuplicates: true
    });
  }

  console.log("RBAC seed completado");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
