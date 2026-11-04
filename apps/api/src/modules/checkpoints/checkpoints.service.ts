import { createHash, randomBytes } from "node:crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CheckpointStatus, Prisma, QrStatus } from "@mas/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCheckpointDto } from "./dto/create-checkpoint.dto";

@Injectable()
export class CheckpointsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const checkpoints = await this.prisma.checkpoint.findMany({
      where: { status: CheckpointStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        latitude: true,
        longitude: true,
        radiusMeter: true,
        accuracyLimitMeter: true,
        status: true,
        organization: { select: { id: true, name: true } },
      },
    });
    return { success: true, data: checkpoints };
  }

  async create(input: CreateCheckpointDto) {
    try {
      const checkpoint = await this.prisma.checkpoint.create({
        data: {
          ...input,
          latitude: new Prisma.Decimal(input.latitude),
          longitude: new Prisma.Decimal(input.longitude),
          radiusMeter: new Prisma.Decimal(input.radiusMeter),
          accuracyLimitMeter: new Prisma.Decimal(input.accuracyLimitMeter),
        },
        select: { id: true, code: true, name: true, status: true, organizationId: true },
      });
      return { success: true, data: checkpoint };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ code: "RESOURCE_CONFLICT" });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
      }
      throw error;
    }
  }

  async generateQr(checkpointId: string, createdBy: string) {
    const checkpoint = await this.prisma.checkpoint.findFirst({
      where: { id: checkpointId, status: CheckpointStatus.ACTIVE },
      select: { id: true },
    });
    if (!checkpoint) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM checkpoints WHERE id = ${checkpointId}::uuid FOR UPDATE`;
      const active = await transaction.checkpointQr.findMany({
        where: { checkpointId, status: QrStatus.ACTIVE },
        select: { version: true },
      });
      const version = Math.max(0, ...active.map((qr) => qr.version)) + 1;
      await transaction.checkpointQr.updateMany({
        where: { checkpointId, status: QrStatus.ACTIVE },
        data: { status: QrStatus.REVOKED, revokedAt: new Date() },
      });
      const qr = await transaction.checkpointQr.create({
        data: { checkpointId, tokenHash, version, status: QrStatus.ACTIVE, createdBy },
        select: { id: true, checkpointId: true, version: true, status: true },
      });
      return qr;
    });

    return {
      success: true,
      message: "QR berhasil dibuat",
      data: { ...result, token },
    };
  }

  async revokeQr(checkpointId: string, reason: string) {
    const result = await this.prisma.checkpointQr.updateMany({
      where: { checkpointId, status: QrStatus.ACTIVE },
      data: { status: QrStatus.REVOKED, revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND" });
    return { success: true, message: "QR berhasil dicabut", data: { reason } };
  }

  async validateQr(token: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const qr = await this.prisma.checkpointQr.findFirst({
      where: { tokenHash, status: QrStatus.ACTIVE },
      include: { checkpoint: true },
    });
    if (!qr || qr.checkpoint.status !== CheckpointStatus.ACTIVE) {
      throw new NotFoundException({ code: "QR_INVALID" });
    }
    return {
      success: true,
      data: {
        checkpoint: { id: qr.checkpoint.id, code: qr.checkpoint.code, name: qr.checkpoint.name, status: qr.checkpoint.status },
        qrStatus: qr.status,
      },
    };
  }
}