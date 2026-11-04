import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@mas/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, parentId: true, code: true, name: true, organizationType: true, isActive: true },
    }).then((data) => ({ success: true, data }));
  }

  async create(input: CreateOrganizationDto) {
    try {
      const data = await this.prisma.organization.create({
        data: input,
        select: { id: true, parentId: true, code: true, name: true, organizationType: true, isActive: true },
      });
      return { success: true, data };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ code: "RESOURCE_CONFLICT" });
      }
      if (input.parentId) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
      throw error;
    }
  }
}