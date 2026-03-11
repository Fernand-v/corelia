import type { RoleCode } from "@corelia/types";
import { AdminCommonService, ROLE_ORDER } from "./common.js";

export class AdminRolesAccessService extends AdminCommonService {
  async getRolesMatrix(actorId: string) {
    const roles = await this.listRoles(actorId);
    return roles.map((role) => ({
      role: role.code,
      permissions: role.permissions.map((permission) => permission.code)
    }));
  }

  async listRoles(actorId: string) {
    await this.assertAdmin(actorId);

    const roles = await this.app.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: {
              include: {
                category: true
              }
            }
          }
        }
      },
      orderBy: [{ isSystem: "desc" }, { rank: "desc" }, { displayName: "asc" }]
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.key,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      scope: role.scope,
      rank: role.rank,
      permissions: role.rolePermissions
        .map((entry) => entry.permission)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((permission) => ({
          id: permission.id,
          code: permission.key,
          displayName: permission.displayName,
          description: permission.description,
          category: {
            id: permission.category.id,
            code: permission.category.key,
            displayName: permission.category.displayName,
            sortOrder: permission.category.sortOrder
          }
        }))
    }));
  }

  async getRole(actorId: string, roleId: string) {
    await this.assertAdmin(actorId);

    const role = await this.app.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!role) {
      throw new Error("Rol no encontrado");
    }

    return {
      id: role.id,
      code: role.key,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      scope: role.scope,
      rank: role.rank,
      permissions: role.rolePermissions
        .map((entry) => entry.permission)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((permission) => ({
          id: permission.id,
          code: permission.key,
          displayName: permission.displayName,
          description: permission.description,
          category: {
            id: permission.category.id,
            code: permission.category.key,
            displayName: permission.category.displayName,
            sortOrder: permission.category.sortOrder
          }
        }))
    };
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

  async replaceRolePermissions(
    actorId: string,
    roleId: string,
    permissionCodes: string[]
  ) {
    await this.assertAdmin(actorId);

    const role = await this.app.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, isSystem: true, code: true }
    });

    if (!role) {
      throw new Error("Rol no encontrado");
    }

    if (role.isSystem) {
      throw this.forbidden("Los roles del sistema no permiten cambios de permisos");
    }

    const uniqueCodes = [...new Set(permissionCodes)];
    const permissions = await this.app.prisma.permission.findMany({
      where: {
        key: {
          in: uniqueCodes
        }
      },
      select: {
        id: true,
        key: true
      }
    });

    if (permissions.length !== uniqueCodes.length) {
      throw new Error("Hay permisos inválidos en la solicitud");
    }

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

    const totalAssignments =
      usersAssigned + membersAssigned + invitesAssigned + meetingParticipantsAssigned;

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

  async listPermissions(actorId: string) {
    await this.assertAdmin(actorId);

    const permissions = await this.app.prisma.permission.findMany({
      include: {
        category: true
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { code: "asc" }]
    });

    return permissions.map((permission) => ({
      id: permission.id,
      code: permission.key,
      displayName: permission.displayName,
      description: permission.description,
      category: {
        id: permission.category.id,
        code: permission.category.key,
        displayName: permission.category.displayName,
        sortOrder: permission.category.sortOrder
      }
    }));
  }

  async listPermissionCategories(actorId: string) {
    await this.assertAdmin(actorId);

    const categories = await this.app.prisma.permissionCategory.findMany({
      include: {
        permissions: {
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
        categoryId: permission.categoryId
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
