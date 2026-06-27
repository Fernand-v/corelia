import { PrismaClient } from "@prisma/client";
import {
  RBAC_PROGRAMS,
  RBAC_PERMISSION_CATEGORIES,
  RBAC_PERMISSIONS_ENRICHED,
  RBAC_RESOURCES,
  RBAC_ACTIONS,
  RBAC_ROLE_PERMISSION_MATRIX,
  RBAC_SYSTEM_ROLES
} from "@corelia/types";

const prisma = new PrismaClient();

async function main() {
  for (const [index, program] of RBAC_PROGRAMS.entries()) {
    await prisma.program.upsert({
      where: { key: program.code },
      update: {
        code: index + 1,
        key: program.code,
        displayName: program.displayName,
        description: program.description,
        sortOrder: program.sortOrder,
        isSystem: true,
        isActive: true
      },
      create: {
        code: index + 1,
        key: program.code,
        displayName: program.displayName,
        description: program.description,
        sortOrder: program.sortOrder,
        isSystem: true,
        isActive: true
      }
    });
  }

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

  for (const [index, resource] of RBAC_RESOURCES.entries()) {
    await prisma.resource.upsert({
      where: { key: resource.code },
      update: {
        key: resource.code,
        displayName: resource.displayName,
        sortOrder: index,
        isSystem: true,
        isActive: true
      },
      create: {
        key: resource.code,
        displayName: resource.displayName,
        sortOrder: index,
        isSystem: true,
        isActive: true
      }
    });
  }

  for (const [index, action] of RBAC_ACTIONS.entries()) {
    await prisma.action.upsert({
      where: { key: action.code },
      update: {
        key: action.code,
        displayName: action.displayName,
        kind: action.kind,
        sortOrder: index,
        isSystem: true,
        isActive: true
      },
      create: {
        key: action.code,
        displayName: action.displayName,
        kind: action.kind,
        sortOrder: index,
        isSystem: true,
        isActive: true
      }
    });
  }

  const categories = await prisma.permissionCategory.findMany({
    select: {
      id: true,
      key: true
    }
  });
  const programs = await prisma.program.findMany({
    select: {
      id: true,
      key: true
    }
  });
  const resources = await prisma.resource.findMany({ select: { id: true, key: true } });
  const actions = await prisma.action.findMany({ select: { id: true, key: true } });
  const categoryIdByKey = new Map(categories.map((category) => [category.key, category.id]));
  const programIdByKey = new Map(programs.map((program) => [program.key, program.id]));
  const resourceIdByKey = new Map(resources.map((resource) => [resource.key, resource.id]));
  const actionIdByKey = new Map(actions.map((action) => [action.key, action.id]));

  for (const [index, permission] of RBAC_PERMISSIONS_ENRICHED.entries()) {
    const categoryId = categoryIdByKey.get(permission.categoryCode);
    if (!categoryId) {
      throw new Error(`Categoria de permiso no encontrada: ${permission.categoryCode}`);
    }
    const programId = programIdByKey.get(permission.programCode);
    if (!programId) {
      throw new Error(`Programa no encontrado para permiso: ${permission.programCode}`);
    }
    const resourceId = resourceIdByKey.get(permission.resource);
    if (!resourceId) {
      throw new Error(`Recurso no encontrado para permiso: ${permission.resource}`);
    }
    const actionId = actionIdByKey.get(permission.action);
    if (!actionId) {
      throw new Error(`Accion no encontrada para permiso: ${permission.action}`);
    }

    await prisma.permission.upsert({
      where: { key: permission.code },
      update: {
        code: index + 1,
        key: permission.code,
        displayName: permission.displayName,
        description: permission.description,
        categoryId,
        programId,
        resourceId,
        actionId,
        isSystem: true,
        isActive: true
      },
      create: {
        code: index + 1,
        key: permission.code,
        displayName: permission.displayName,
        description: permission.description,
        categoryId,
        programId,
        resourceId,
        actionId,
        isSystem: true,
        isActive: true
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

  const [roles, programs, permissions] = await Promise.all([
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
    prisma.program.findMany({
      where: {
        key: {
          in: RBAC_PROGRAMS.map((program) => program.code)
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
  const programIdBySeedKey = new Map(programs.map((program) => [program.key, program.id]));
  const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
  const permissionProgramCodeByPermissionCode = new Map(
    RBAC_PERMISSIONS.map((permission) => [permission.code, permission.programCode])
  );

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

    await prisma.programRole.deleteMany({
      where: {
        roleId
      }
    });

    if (permissionCodes.length > 0) {
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

    const programCodesForRole = new Set<string>();
    if (role.code === "ADMINISTRADOR") {
      for (const program of RBAC_PROGRAMS) {
        programCodesForRole.add(program.code);
      }
    } else {
      for (const permissionCode of permissionCodes) {
        const programCode = permissionProgramCodeByPermissionCode.get(permissionCode);
        if (programCode) {
          programCodesForRole.add(programCode);
        }
      }
    }

    const roleProgramRows = [...programCodesForRole].map((programCode) => {
      const programId = programIdBySeedKey.get(programCode);
      if (!programId) {
        throw new Error(`Programa no encontrado para asignar a rol: ${programCode}`);
      }
      return {
        roleId,
        programId
      };
    });

    if (roleProgramRows.length > 0) {
      await prisma.programRole.createMany({
        data: roleProgramRows,
        skipDuplicates: true
      });
    }
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
