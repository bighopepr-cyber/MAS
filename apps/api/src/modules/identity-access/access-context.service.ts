import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/authenticated-user";

@Injectable()
export class AccessContextService {
  constructor(private readonly prisma: PrismaService) {}

  async load(userId: string): Promise<AuthenticatedUser> {
    const now = new Date();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        roles: {
          where: {
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        directPermissions: {
          where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          include: { permission: true },
        },
      },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException({ code: "ACCOUNT_INACTIVE" });
    }

    const roles = user.roles
      .filter((assignment) => assignment.role.isActive)
      .map((assignment) => assignment.role);
    const denied = new Set(
      user.directPermissions
        .filter((assignment) => assignment.effect === "DENY")
        .map((assignment) => assignment.permission.code),
    );
    const permissions = new Set(
      roles.flatMap((role) => role.permissions.map((item) => item.permission.code)),
    );

    for (const assignment of user.directPermissions) {
      if (assignment.effect === "ALLOW") permissions.add(assignment.permission.code);
    }
    for (const permission of denied) permissions.delete(permission);

    return {
      id: user.id,
      username: user.username,
      accountType: user.accountType,
      roles: roles.map((role) => role.code),
      permissions: [...permissions],
    };
  }
}