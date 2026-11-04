import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type AccountType } from "@mas/database";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateUserDto) {
    this.validateProfile(input.accountType, input.profile);
    const pinHash = await argon2.hash(input.pin, { type: argon2.argon2id });

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            username: input.username,
            pinHash,
            accountType: input.accountType,
            isActive: true,
            isVerified: true,
          },
        });

        if (input.accountType === "MILITARY") {
          await transaction.militaryPersonnel.create({
            data: {
              userId: user.id,
              nrp: input.profile!.nrp!,
              fullName: input.profile!.fullName!,
              rank: input.profile!.rank,
              position: input.profile!.position,
              personnelStatus: "ACTIVE",
            },
          });
          const militaryRole = await transaction.role.findUnique({ where: { code: "MILITARY" } });
          if (militaryRole) {
            await transaction.userRole.create({ data: { userId: user.id, roleId: militaryRole.id } });
          }
        } else if (input.accountType === "PERSIT") {
          await transaction.persitMember.create({
            data: {
              userId: user.id,
              memberNumber: input.profile!.memberNumber!,
              fullName: input.profile!.fullName!,
              membershipStatus: "ACTIVE",
            },
          });
        }

        return {
          success: true,
          data: {
            id: user.id,
            username: user.username,
            accountType: user.accountType,
            isActive: user.isActive,
          },
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ code: "RESOURCE_CONFLICT" });
      }
      throw error;
    }
  }

  async list(page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where = { deletedAt: null };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        select: {
          id: true,
          username: true,
          accountType: true,
          isActive: true,
          createdAt: true,
          militaryProfile: { select: { nrp: true, fullName: true } },
          persitProfile: { select: { memberNumber: true, fullName: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      success: true,
      data: users,
      meta: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        username: true,
        accountType: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        militaryProfile: true,
        persitProfile: true,
      },
    });
    if (!user) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    return { success: true, data: user };
  }

  async resetPin(id: string, newPin: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    const superAdminAssignment = await this.prisma.userRole.findFirst({
      where: { userId: id, isActive: true, role: { code: "SUPER_ADMIN" } },
    });
    if (superAdminAssignment) {
      throw new ForbiddenException({ code: "PERMISSION_DENIED" });
    }
    const pinHash = await argon2.hash(newPin, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { pinHash } }),
      this.prisma.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true, message: "PIN berhasil direset", data: null };
  }

  private validateProfile(accountType: AccountType, profile: CreateUserDto["profile"]): void {
    if (accountType === "SYSTEM") {
      if (profile) throw new BadRequestException({ code: "VALIDATION_ERROR" });
      return;
    }
    if (!profile?.fullName) throw new BadRequestException({ code: "VALIDATION_ERROR" });
    if (accountType === "MILITARY" && !profile.nrp) {
      throw new BadRequestException({ code: "VALIDATION_ERROR" });
    }
    if (accountType === "PERSIT" && !profile.memberNumber) {
      throw new BadRequestException({ code: "VALIDATION_ERROR" });
    }
  }
}