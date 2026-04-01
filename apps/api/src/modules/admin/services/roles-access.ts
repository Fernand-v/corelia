import type { RoleCode } from "@corelia/types";
import { AdminCommonService, ROLE_ORDER } from "./common.js";

export class AdminRolesAccessService extends AdminCommonService {
  private normalizeProgramCode(input: { code?: string; displayName: string }) {
    const source = (input.code ?? input.displayName).trim();
    const normalized = source
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 _-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();

    if (!normalized) {
      throw new Error("No se pudo generar un codigo de programa valido");
    }

    return normalized;
  }

  private normalizePermissionCode(input: { code?: string; displayName: string }) {
    const source = (input.code ?? input.displayName).trim();
    const normalized = source
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 _-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();

    if (!normalized) {
      throw new Error("No se pudo generar un codigo de permiso valido");
    }

    return normalized;
  }

  private mapProgram(program: {
    id: string;
    code: number;
    key: string;
    displayName: string;
    description: string | null;
    sortOrder: number;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: program.id,
      code: program.key,
      numericCode: program.code,
      displayName: program.displayName,
      description: program.description,
      sortOrder: program.sortOrder,
      isSystem: program.isSystem,
      isActive: program.isActive,
      createdAt: program.createdAt.toISOString(),
      updatedAt: program.updatedAt.toISOString()
    };
  }

  private mapPermission(permission: {
    id: string;
    key: string;
    displayName: string;
    description: string | null;
    categoryId: string;
    programId: string;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    category: {
      id: string;
      key: string;
      displayName: string;
      sortOrder: number;
    };
    program: {
      id: string;
      key: string;
      displayName: string;
      sortOrder: number;
    };
  }) {
    return {
      id: permission.id,
      code: permission.key,
      displayName: permission.displayName,
      description: permission.description,
      categoryId: permission.categoryId,
      categoryCode: permission.category.key,
      categoryDisplayName: permission.category.displayName,
      categorySortOrder: permission.category.sortOrder,
      programId: permission.programId,
      programCode: permission.program.key,
      programDisplayName: permission.program.displayName,
      programSortOrder: permission.program.sortOrder,
      isSystem: permission.isSystem,
      isActive: permission.isActive,
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
      category: {
        id: permission.category.id,
        code: permission.category.key,
        displayName: permission.category.displayName,
        sortOrder: permission.category.sortOrder
      },
      program: {
        id: permission.program.id,
        code: permission.program.key,
        displayName: permission.program.displayName,
        sortOrder: permission.program.sortOrder
      }
    };
  }

  private mapRole(role: {
    id: string;
    key: string;
    displayName: string;
    description: string | null;
    isSystem: boolean;
    scope: "GLOBAL" | "PROJECT";
    rank: number;
    programRoles: Array<{
      program: {
        id: string;
        code: number;
        key: string;
        displayName: string;
        description: string | null;
        sortOrder: number;
        isSystem: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
    rolePermissions: Array<{
      permission: {
        id: string;
        key: string;
        displayName: string;
        description: string | null;
        categoryId: string;
        programId: string;
        isSystem: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        category: {
          id: string;
          key: string;
          displayName: string;
          sortOrder: number;
        };
        program: {
          id: string;
          key: string;
          displayName: string;
          sortOrder: number;
        };
      };
    }>;
  }) {
    const programs = role.programRoles
      .map((entry) => entry.program)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName))
      .map((program) => this.mapProgram(program));

    const permissions = role.rolePermissions
      .map((entry) => entry.permission)
      .sort(
        (a, b) =>
          a.program.sortOrder - b.program.sortOrder ||
          a.category.sortOrder - b.category.sortOrder ||
          a.key.localeCompare(b.key)
      )
      .map((permission) => this.mapPermission(permission));

    return {
      id: role.id,
      code: role.key,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      scope: role.scope,
      rank: role.rank,
      programs,
      permissions
    };
  }

  private async assignDefaultAdminAccess(input: { permissionId?: string; programId: string }) {
    const adminRole = await this.app.prisma.role.findUnique({
      where: {
        key: "ADMINISTRADOR"
      },
      select: {
        id: true
      }
    });

    if (!adminRole) {
      return;
    }

    await this.app.prisma.programRole.createMany({
      data: [
        {
          roleId: adminRole.id,
          programId: input.programId
        }
      ],
      skipDuplicates: true
    });

    if (input.permissionId) {
      await this.app.prisma.rolePermission.createMany({
        data: [
          {
            roleId: adminRole.id,
            permissionId: input.permissionId
          }
        ],
        skipDuplicates: true
      });
    }
  }

  async getRolesMatrix(actorId: string) {
    const roles = await this.listRoles(actorId);
    return roles.map((role) => ({
      role: role.code,
      programs: role.programs.map((program) => program.code),
      permissions: role.permissions.map((permission) => permission.code)
    }));
  }

  async listRoles(actorId: string) {
    await this.assertAdmin(actorId);

    const roles = await this.app.prisma.role.findMany({
      include: {
        programRoles: {
          where: {
            program: {
              isActive: true
            }
          },
          include: {
            program: true
          }
        },
        rolePermissions: {
          where: {
            permission: {
              isActive: true
            }
          },
          include: {
            permission: {
              include: {
                category: true,
                program: true
              }
            }
          }
        }
      },
      orderBy: [{ isSystem: "desc" }, { rank: "desc" }, { displayName: "asc" }]
    });

    return roles.map((role) => this.mapRole(role));
  }

  async getRole(actorId: string, roleId: string) {
    await this.assertAdmin(actorId);

    const role = await this.app.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        programRoles: {
          where: {
            program: {
              isActive: true
            }
          },
          include: {
            program: true
          }
        },
        rolePermissions: {
          where: {
            permission: {
              isActive: true
            }
          },
          include: {
            permission: {
              include: {
                category: true,
                program: true
              }
            }
          }
        }
      }
    });

    if (!role) {
      throw new Error("Rol no encontrado");
    }

    return this.mapRole(role);
  }

  async getRoleAccess(actorId: string, roleId: string) {
    return this.getRole(actorId, roleId);
  }

  async createRole(
    actorId: string,
    input: {
      code?: string;
      displayName: string;
      description?: string | null;
      rank?: number;
    }
  ) {
    await this.assertAdmin(actorId);

    const code = this.normalizeRoleCode({
      ...(input.code ? { code: input.code } : {}),
      displayName: input.displayName
    });

    if (ROLE_ORDER.includes(code as RoleCode)) {
      throw this.forbidden("No se puede reemplazar ni duplicar un rol de sistema");
    }

    const role = await this.app.prisma.role.create({
      data: {
        key: code,
        displayName: input.displayName,
        description: input.description ?? null,
        isSystem: false,
        scope: "PROJECT",
        rank: input.rank ?? 0
      }
    });

    return {
      id: role.id,
      code: role.key,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      scope: role.scope,
      rank: role.rank
    };
  }

  async updateRole(
    actorId: string,
    roleId: string,
    input: {
      displayName?: string;
      description?: string | null;
      rank?: number;
    }
  ) {
    await this.assertAdmin(actorId);

    const role = await this.app.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, isSystem: true }
    });

    if (!role) {
      throw new Error("Rol no encontrado");
    }

    if (role.isSystem) {
      throw this.forbidden("Los roles del sistema no son editables");
    }

    const updated = await this.app.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.rank !== undefined ? { rank: input.rank } : {})
      }
    });

    await this.invalidateRoleCache(roleId);

    return {
      id: updated.id,
      code: updated.key,
      displayName: updated.displayName,
      description: updated.description,
      isSystem: updated.isSystem,
      scope: updated.scope,
      rank: updated.rank
    };
  }

  async replaceRolePermissions(actorId: string, roleId: string, permissionCodes: string[]) {
    await this.assertAdmin(actorId);

    const role = await this.app.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true }
    });

    if (!role) {
      throw new Error("Rol no encontrado");
    }

    const uniqueCodes = [...new Set(permissionCodes)];
    const permissions = await this.app.prisma.permission.findMany({
      where: {
        key: {
          in: uniqueCodes
        },
        isActive: true
      },
      select: {
        id: true,
        key: true,
        programId: true
      }
    });

    if (permissions.length !== uniqueCodes.length) {
      throw new Error("Hay permisos inválidos en la solicitud");
    }

    const permissionProgramIds = [...new Set(permissions.map((permission) => permission.programId))];

    await this.app.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: {
          roleId
        }
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id
          })),
          skipDuplicates: true
        });
      }

      if (permissionProgramIds.length > 0) {
        await tx.programRole.createMany({
          data: permissionProgramIds.map((programId) => ({
            roleId,
            programId
          })),
          skipDuplicates: true
        });
      }
    });

    await this.invalidateRoleCache(roleId);

    return this.getRole(actorId, roleId);
  }

  async replaceRoleAccess(
    actorId: string,
    roleId: string,
    input: {
      programCodes: string[];
      permissionCodes: string[];
    }
  ) {
    await this.assertAdmin(actorId);

    const role = await this.app.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true }
    });

    if (!role) {
      throw new Error("Rol no encontrado");
    }

    const uniqueProgramCodes = [...new Set(input.programCodes)];
    const uniquePermissionCodes = [...new Set(input.permissionCodes)];

    const [programs, permissions] = await Promise.all([
      this.app.prisma.program.findMany({
        where: {
          key: {
            in: uniqueProgramCodes
          },
          isActive: true
        },
        select: {
          id: true,
          key: true
        }
      }),
      this.app.prisma.permission.findMany({
        where: {
          key: {
            in: uniquePermissionCodes
          },
          isActive: true
        },
        select: {
          id: true,
          key: true
        }
      })
    ]);

    if (programs.length !== uniqueProgramCodes.length) {
      throw new Error("Hay programas inválidos en la solicitud");
    }

    if (permissions.length !== uniquePermissionCodes.length) {
      throw new Error("Hay permisos inválidos en la solicitud");
    }

    await this.app.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: {
          roleId
        }
      });

      await tx.programRole.deleteMany({
        where: {
          roleId
        }
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id
          })),
          skipDuplicates: true
        });
      }

      if (programs.length > 0) {
        await tx.programRole.createMany({
          data: programs.map((program) => ({
            roleId,
            programId: program.id
          })),
          skipDuplicates: true
        });
      }
    });

    await this.invalidateRoleCache(roleId);

    return this.getRole(actorId, roleId);
  }

  async deleteRole(actorId: string, roleId: string) {
    await this.assertAdmin(actorId);

    const role = await this.app.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, code: true, isSystem: true }
    });

    if (!role) {
      throw new Error("Rol no encontrado");
    }

    if (role.isSystem) {
      throw this.forbidden("Los roles del sistema no se pueden eliminar");
    }

    const [usersAssigned, membersAssigned, invitesAssigned, meetingParticipantsAssigned] = await Promise.all([
      this.app.prisma.user.count({ where: { baseRoleId: roleId } }),
      this.app.prisma.projectMember.count({ where: { roleId } }),
      this.app.prisma.internalInvite.count({ where: { baseRoleId: roleId } }),
      this.app.prisma.meetingParticipant.count({ where: { roleId } })
    ]);

    const totalAssignments = usersAssigned + membersAssigned + invitesAssigned + meetingParticipantsAssigned;

    if (totalAssignments > 0) {
      throw this.conflict("No se puede eliminar un rol asignado a usuarios o entidades activas");
    }

    await this.app.prisma.role.delete({
      where: { id: roleId }
    });

    await this.invalidateRoleCache(roleId);

    return {
      success: true
    };
  }

  async listPrograms(actorId: string, input?: { includeInactive?: boolean }) {
    await this.assertAdmin(actorId);

    const programs = await this.app.prisma.program.findMany({
      ...(input?.includeInactive ? {} : { where: { isActive: true } }),
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }]
    });

    return programs.map((program) => this.mapProgram(program));
  }

  async createProgram(
    actorId: string,
    input: {
      code?: string;
      displayName: string;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    await this.assertAdmin(actorId);

    const code = this.normalizeProgramCode({
      ...(input.code ? { code: input.code } : {}),
      displayName: input.displayName
    });

    const created = await this.app.prisma.program.create({
      data: {
        key: code,
        displayName: input.displayName,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        isSystem: false,
        isActive: input.isActive ?? true
      }
    });

    await this.assignDefaultAdminAccess({ programId: created.id });
    await this.invalidateRbacCache();

    return this.mapProgram(created);
  }

  async updateProgram(
    actorId: string,
    programId: string,
    input: {
      displayName?: string;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    await this.assertAdmin(actorId);

    const current = await this.app.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        isSystem: true
      }
    });

    if (!current) {
      throw new Error("Programa no encontrado");
    }

    if (current.isSystem && input.isActive === false) {
      throw this.forbidden("Los programas del sistema no se pueden desactivar");
    }

    const updated = await this.app.prisma.program.update({
      where: {
        id: programId
      },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });

    await this.invalidateRbacCache();

    return this.mapProgram(updated);
  }

  async deactivateProgram(actorId: string, programId: string) {
    await this.assertAdmin(actorId);

    const program = await this.app.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        isSystem: true
      }
    });

    if (!program) {
      throw new Error("Programa no encontrado");
    }

    if (program.isSystem) {
      throw this.forbidden("Los programas del sistema no se pueden eliminar");
    }

    const updated = await this.app.prisma.program.update({
      where: {
        id: programId
      },
      data: {
        isActive: false
      }
    });

    await this.invalidateRbacCache();

    return this.mapProgram(updated);
  }

  async listPermissions(actorId: string, input?: { includeInactive?: boolean }) {
    await this.assertAdmin(actorId);

    const permissions = await this.app.prisma.permission.findMany({
      ...(input?.includeInactive ? {} : { where: { isActive: true } }),
      include: {
        category: true,
        program: true
      },
      orderBy: [{ program: { sortOrder: "asc" } }, { category: { sortOrder: "asc" } }, { code: "asc" }]
    });

    return permissions.map((permission) => this.mapPermission(permission));
  }

  async createPermission(
    actorId: string,
    input: {
      code?: string;
      displayName: string;
      description?: string | null;
      categoryCode: string;
      programCode: string;
    }
  ) {
    await this.assertAdmin(actorId);

    const [category, program] = await Promise.all([
      this.app.prisma.permissionCategory.findUnique({
        where: {
          key: input.categoryCode
        },
        select: {
          id: true
        }
      }),
      this.app.prisma.program.findUnique({
        where: {
          key: input.programCode
        },
        select: {
          id: true,
          isActive: true
        }
      })
    ]);

    if (!category) {
      throw new Error("Categoria de permiso no encontrada");
    }

    if (!program || !program.isActive) {
      throw new Error("Programa no encontrado o inactivo");
    }

    const code = this.normalizePermissionCode({
      ...(input.code ? { code: input.code } : {}),
      displayName: input.displayName
    });

    const created = await this.app.prisma.permission.create({
      data: {
        key: code,
        displayName: input.displayName,
        description: input.description ?? null,
        categoryId: category.id,
        programId: program.id,
        isSystem: false,
        isActive: true
      },
      include: {
        category: true,
        program: true
      }
    });

    await this.assignDefaultAdminAccess({
      permissionId: created.id,
      programId: created.programId
    });
    await this.invalidateRbacCache();

    return this.mapPermission(created);
  }

  async updatePermission(
    actorId: string,
    permissionId: string,
    input: {
      displayName?: string;
      description?: string | null;
      categoryCode?: string;
      programCode?: string;
      isActive?: boolean;
    }
  ) {
    await this.assertAdmin(actorId);

    const current = await this.app.prisma.permission.findUnique({
      where: {
        id: permissionId
      },
      select: {
        id: true,
        isSystem: true,
        programId: true
      }
    });

    if (!current) {
      throw new Error("Permiso no encontrado");
    }

    if (current.isSystem && input.isActive === false) {
      throw this.forbidden("Los permisos del sistema no se pueden eliminar");
    }

    const [category, program] = await Promise.all([
      input.categoryCode
        ? this.app.prisma.permissionCategory.findUnique({
            where: {
              key: input.categoryCode
            },
            select: {
              id: true
            }
          })
        : Promise.resolve(null),
      input.programCode
        ? this.app.prisma.program.findUnique({
            where: {
              key: input.programCode
            },
            select: {
              id: true,
              isActive: true
            }
          })
        : Promise.resolve(null)
    ]);

    if (input.categoryCode && !category) {
      throw new Error("Categoria de permiso no encontrada");
    }

    if (input.programCode && (!program || !program.isActive)) {
      throw new Error("Programa no encontrado o inactivo");
    }

    const updated = await this.app.prisma.permission.update({
      where: {
        id: permissionId
      },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(category ? { categoryId: category.id } : {}),
        ...(program ? { programId: program.id } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      },
      include: {
        category: true,
        program: true,
        rolePermissions: {
          select: {
            roleId: true
          }
        }
      }
    });

    const roleIdsToBackfill = [...new Set(updated.rolePermissions.map((entry) => entry.roleId))];
    if (roleIdsToBackfill.length > 0) {
      await this.app.prisma.programRole.createMany({
        data: roleIdsToBackfill.map((roleId) => ({
          roleId,
          programId: updated.programId
        })),
        skipDuplicates: true
      });
    }

    await this.invalidateRbacCache();

    return this.mapPermission(updated);
  }

  async deactivatePermission(actorId: string, permissionId: string) {
    await this.assertAdmin(actorId);

    const permission = await this.app.prisma.permission.findUnique({
      where: { id: permissionId },
      select: {
        id: true,
        isSystem: true
      }
    });

    if (!permission) {
      throw new Error("Permiso no encontrado");
    }

    if (permission.isSystem) {
      throw this.forbidden("Los permisos del sistema no se pueden eliminar");
    }

    const updated = await this.app.prisma.permission.update({
      where: {
        id: permissionId
      },
      data: {
        isActive: false
      },
      include: {
        category: true,
        program: true
      }
    });

    await this.invalidateRbacCache();

    return this.mapPermission(updated);
  }

  async listPermissionCategories(actorId: string) {
    await this.assertAdmin(actorId);

    const categories = await this.app.prisma.permissionCategory.findMany({
      include: {
        permissions: {
          where: {
            isActive: true
          },
          include: {
            program: true
          },
          orderBy: {
            code: "asc"
          }
        }
      },
      orderBy: {
        sortOrder: "asc"
      }
    });

    return categories.map((category) => ({
      id: category.id,
      code: category.key,
      displayName: category.displayName,
      description: category.description,
      sortOrder: category.sortOrder,
      permissions: category.permissions.map((permission) => ({
        id: permission.id,
        code: permission.key,
        displayName: permission.displayName,
        description: permission.description,
        categoryId: permission.categoryId,
        programId: permission.programId,
        programCode: permission.program.key,
        isSystem: permission.isSystem,
        isActive: permission.isActive
      }))
    }));
  }

  async getAccessByResource(
    actorId: string,
    input: {
      type: "PROYECTO" | "EQUIPO" | "ARCHIVO" | "DOCUMENTO";
      id: string;
    }
  ) {
    await this.assertAdmin(actorId);

    if (input.type === "PROYECTO") {
      const members = await this.app.prisma.projectMember.findMany({
        where: {
          projectId: input.id
        },
        include: {
          role: {
            select: {
              key: true
            }
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      const externalInvites = await this.app.prisma.guestInvite.findMany({
        where: {
          projectId: input.id,
          revokedAt: null
        }
      });

      return [
        ...members.map((member) => ({
          userId: member.userId,
          fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
          email: member.user.email,
          accessLevel: member.role.key
        })),
        ...externalInvites.map((invite) => ({
          userId: invite.id,
          fullName: invite.email,
          email: invite.email,
          accessLevel: "LECTURA_EXTERNA"
        }))
      ];
    }

    if (input.type === "EQUIPO") {
      const members = await this.app.prisma.teamMember.findMany({
        where: {
          teamId: input.id
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              baseRole: {
                select: {
                  key: true
                }
              }
            }
          }
        }
      });

      return members.map((member) => ({
        userId: member.userId,
        fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
        email: member.user.email,
        accessLevel: member.user.baseRole.key
      }));
    }

    const fileQueryId = input.type === "DOCUMENTO" ? undefined : input.id;
    const documentQueryId = input.type === "DOCUMENTO" ? input.id : undefined;

    const [file, document] = await Promise.all([
      fileQueryId
        ? this.app.prisma.fileObject.findUnique({
            where: {
              id: fileQueryId
            },
            include: {
              owner: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          })
        : Promise.resolve(null),
      documentQueryId
        ? this.app.prisma.collaborativeDocument.findUnique({
            where: {
              id: documentQueryId
            },
            include: {
              createdBy: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          })
        : Promise.resolve(null)
    ]);

    const invites = await this.app.prisma.guestInvite.findMany({
      where: {
        ...(input.type === "DOCUMENTO" ? { documentId: input.id } : { fileId: input.id }),
        revokedAt: null
      }
    });

    const ownerEntries = file
      ? [
          {
            userId: file.ownerId,
            fullName: `${file.owner.firstName} ${file.owner.lastName}`.trim(),
            email: file.owner.email,
            accessLevel: "PROPIETARIO"
          }
        ]
      : document
        ? [
            {
              userId: document.createdById,
              fullName: `${document.createdBy.firstName} ${document.createdBy.lastName}`.trim(),
              email: document.createdBy.email,
              accessLevel: "PROPIETARIO"
            }
          ]
        : [];

    return [
      ...ownerEntries,
      ...invites.map((invite) => ({
        userId: invite.id,
        fullName: invite.email,
        email: invite.email,
        accessLevel: "LECTURA_EXTERNA"
      }))
    ];
  }
}
