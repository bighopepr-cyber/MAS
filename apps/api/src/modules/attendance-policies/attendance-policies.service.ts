import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@mas/database";
import type { AuthenticatedUser } from "../../common/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAttendancePolicyDto } from "./dto/attendance-policy.dto";

@Injectable()
export class AttendancePoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const data = await this.prisma.attendancePolicy.findMany({
      orderBy: [{ organizationId: "asc" }, { unitId: "asc" }, { effectiveFrom: "desc" }],
    });
    return { success: true, data };
  }

  async create(user: AuthenticatedUser, input: CreateAttendancePolicyDto) {
    if (input.unitId && !input.organizationId) {
      const unit = await this.prisma.unit.findUnique({ where: { id: input.unitId } });
      if (!unit) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
      input.organizationId = unit.organizationId;
    }
    try {
      const data = await this.prisma.attendancePolicy.create({
        data: {
          ...input,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveUntil: input.effectiveUntil ? new Date(input.effectiveUntil) : null,
          createdBy: user.id,
        },
      });
      return { success: true, data };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
      }
      throw error;
    }
  }

  async update(id: string, input: Partial<CreateAttendancePolicyDto>) {
    const existing = await this.prisma.attendancePolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    try {
      const data = await this.prisma.attendancePolicy.update({
        where: { id },
        data: {
          ...input,
          effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
          effectiveUntil: input.effectiveUntil ? new Date(input.effectiveUntil) : undefined,
        },
      });
      return { success: true, data };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
      }
      throw error;
    }
  }

  async effective(profileType: string, user: AuthenticatedUser) {
    const now = new Date();
    const assignment = await this.prisma.organizationAssignment.findFirst({
      where: {
        userId: user.id,
        isPrimary: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: { startDate: "desc" },
    });
    const policies = await this.prisma.attendancePolicy.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        AND: [
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }] },
          { OR: [{ profileType: null }, { profileType: profileType as "MILITARY" | "PERSIT" }] },
        ],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    const data = policies
      .filter((policy) => !policy.unitId || policy.unitId === assignment?.unitId)
      .filter((policy) => !policy.organizationId || policy.organizationId === assignment?.organizationId)
      .sort((left, right) => this.score(right) - this.score(left))[0] ?? null;
    return { success: true, data };
  }

  private score(policy: { unitId: string | null; organizationId: string | null; profileType: string | null }): number {
    return Number(Boolean(policy.unitId)) * 4 +
      Number(Boolean(policy.organizationId)) * 2 +
      Number(Boolean(policy.profileType));
  }
}