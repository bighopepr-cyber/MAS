import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@mas/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  AssignPermissionsDto,
  AssignRoleDto,
  CreatePermissionDto,
  CreateRoleDto,
  UpdateRoleDto,
} from "./dto/rbac.dto";

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    const data = await this.prisma.role.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true, permissions: true } } },
    });
    return { success: true, data };
  }

  async createRole(input: CreateRoleDto) {
    try {
      const data = await this.prisma.role.create({
        data: {
          code: input.name.trim().toUpperCase(),
          name: input.displayName,
          description: input.description,
          isSystem: false,
        },
      });
      return { success: true, data };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ code: "RESOURCE_CONFLICT" });
      }
      throw error;
    }
  }

  async updateRole(id: string, input: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    if (role.isSystem && input.isActive === false) {
      throw new ForbiddenException({ code: "PERMISSION_DENIED" });
    }
    const data = await this.prisma.role.update({
      where: { id },
      data: {
        name: input.displayName,
        description: input.description,
        isActive: input.isActive,
      },
    });
    return { success: true, data };
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    if (role.isSystem) throw new ForbiddenException({ code: "PERMISSION_DENIED" });
    if (role._count.users > 0) throw new ConflictException({ code: "RESOURCE_CONFLICT" });

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.roleScope.deleteMany({ where: { roleId: id } }),
      this.prisma.role.delete({ where: { id } }),
    ]);
    return { success: true, data: null };
  }

  async getPermissions() {
    const data = await this.prisma.permission.findMany({ orderBy: [{ module: "asc" }, { code: "asc" }] });
    return { success: true, data };
  }

  async createPermission(input: CreatePermissionDto) {
    const segments = input.key.split(".");
    try {
      const data = await this.prisma.permission.create({
        data: {
          code: input.key,
          module: input.module,
          action: segments.slice(1).join("."),
          description: input.description ?? input.displayName,
        },
      });
      return { success: true, data };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ code: "RESOURCE_CONFLICT" });
      }
      throw error;
    }
  }

  async getRolePermissions(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    return { success: true, data: role.permissions.map((item) => item.permission) };
  }

  async assignPermissions(roleId: string, input: AssignPermissionsDto) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    if (role.code === "SUPER_ADMIN" && input.permissionIds.length === 0) {
      throw new ForbiddenException({ code: "PERMISSION_DENIED" });
    }
    const count = await this.prisma.permission.count({ where: { id: { in: input.permissionIds } } });
    if (count !== input.permissionIds.length) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({ where: { roleId } });
      if (input.permissionIds.length) {
        await transaction.rolePermission.createMany({
          data: input.permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
    });
    return this.getRolePermissions(roleId);
  }

  async assignRole(userId: string, input: AssignRoleDto, assignedBy: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } }),
      this.prisma.role.findUnique({ where: { id: input.roleId } }),
    ]);
    if (!user || !role) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    if (!role.isActive) throw new ForbiddenException({ code: "PERMISSION_DENIED" });

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.userRole.create({
          data: { userId, roleId: role.id, assignedBy },
        });
        if (input.scope) {
          let organizationId = input.scope.organizationId;
          if (input.scope.unitId) {
            const unit = await transaction.unit.findUnique({ where: { id: input.scope.unitId } });
            if (!unit) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
            organizationId ??= unit.organizationId;
          }
          if (!organizationId) throw new ForbiddenException({ code: "VALIDATION_ERROR" });
          await transaction.roleScope.upsert({
            where: {
              roleId_organizationId_scopeType: {
                roleId: role.id,
                organizationId,
                scopeType: input.scope.type,
              },
            },
            update: {},
            create: { roleId: role.id, organizationId, scopeType: input.scope.type },
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ code: "RESOURCE_CONFLICT" });
      }
      throw error;
    }
    return this.listUserRoles(userId);
  }

  async listUserRoles(userId: string) {
    const data = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { scopes: true } } },
    });
    return { success: true, data };
  }

  async removeRole(userId: string, roleId: string) {
    const assignment = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      include: { role: true, user: { include: { roles: { where: { isActive: true } } } } },
    });
    if (!assignment) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    if (assignment.role.code === "SUPER_ADMIN" && assignment.user.roles.length <= 1) {
      throw new ForbiddenException({ code: "PERMISSION_DENIED" });
    }
    await this.prisma.userRole.update({
      where: { userId_roleId: { userId, roleId } },
      data: { isActive: false },
    });
    return { success: true, data: null };
  }

  async assignDirectPermission(userId: string, permissionId: string, effect: "ALLOW" | "DENY", assignedBy: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    try {
      const data = await this.prisma.userPermission.upsert({
        where: { userId_permissionId: { userId, permissionId } },
        update: { effect, assignedBy },
        create: { userId, permissionId, effect, assignedBy },
      });
      return { success: true, data };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
      }
      throw error;
    }
  }
}