import { createHash } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AttendanceEventType, AttendanceSessionStatus, Prisma, ProfileType } from "@mas/database";
import type { AuthenticatedUser } from "../../common/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import { AttendanceScanDto } from "./dto/attendance-scan.dto";
import { haversineDistanceMeters } from "./geo";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async scan(user: AuthenticatedUser, input: AttendanceScanDto) {
    const profileType = this.getProfileType(user.accountType);
    const requestFingerprint = this.requestFingerprint(user.id, input);
    const replay = await this.prisma.attendanceEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { checkpoint: true },
    });
    if (replay) return this.returnReplay(replay, user.id, requestFingerprint);

    const qrHash = createHash("sha256").update(input.qrToken).digest("hex");
    const location = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;

      const concurrentReplay = await transaction.attendanceEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { checkpoint: true },
      });
      if (concurrentReplay) {
        return { replay: this.returnReplay(concurrentReplay, user.id, requestFingerprint) };
      }

      const qr = await transaction.checkpointQr.findFirst({
        where: { tokenHash: qrHash, status: "ACTIVE" },
        include: { checkpoint: true },
      });
      if (!qr) {
        throw new UnprocessableEntityException({ code: "QR_INVALID" });
      }
      if (qr.checkpoint.status !== "ACTIVE") {
        throw new UnprocessableEntityException({ code: "CHECKPOINT_INACTIVE" });
      }

      const distanceMeter = haversineDistanceMeters(
        input.latitude,
        input.longitude,
        Number(qr.checkpoint.latitude),
        Number(qr.checkpoint.longitude),
      );
      if (input.accuracy > Number(qr.checkpoint.accuracyLimitMeter)) {
        throw new UnprocessableEntityException({
          code: "GPS_ACCURACY_INSUFFICIENT",
          details: { accuracy: input.accuracy, accuracyLimitMeter: Number(qr.checkpoint.accuracyLimitMeter) },
        });
      }
      if (distanceMeter > Number(qr.checkpoint.radiusMeter)) {
        throw new UnprocessableEntityException({
          code: "LOCATION_OUTSIDE_GEOFENCE",
          details: { distanceMeter, radiusMeter: Number(qr.checkpoint.radiusMeter) },
        });
      }

      const now = new Date();
      const openSession = await transaction.attendanceSession.findFirst({
        where: { userId: user.id, status: AttendanceSessionStatus.OPEN },
        include: { policy: true },
      });
      const eventType = openSession ? AttendanceEventType.RETURN : AttendanceEventType.EXIT;
      const policy = openSession ? openSession.policy : await this.resolvePolicy(transaction, user.id, profileType, now);
      const device = input.deviceId
        ? await transaction.userDevice.findFirst({
            where: { userId: user.id, deviceFingerprint: input.deviceId, isActive: true },
          })
        : null;

      const session = openSession
        ? await transaction.attendanceSession.update({
            where: { id: openSession.id },
            data: { status: AttendanceSessionStatus.CLOSED, returnAt: now },
          })
        : await transaction.attendanceSession.create({
            data: {
              userId: user.id,
              profileType,
              exitAt: now,
              status: AttendanceSessionStatus.OPEN,
              attendancePolicyId: policy?.id,
            },
          });
      const presenceStatus = eventType === AttendanceEventType.EXIT ? "OUTSIDE" : "INSIDE";
      const event = await transaction.attendanceEvent.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          checkpointId: qr.checkpoint.id,
          deviceId: device?.id,
          profileType,
          eventType,
          validationStatus: "VALID",
          recordedAt: now,
          latitude: new Prisma.Decimal(input.latitude),
          longitude: new Prisma.Decimal(input.longitude),
          accuracy: new Prisma.Decimal(input.accuracy),
          distanceMeter: new Prisma.Decimal(distanceMeter),
          idempotencyKey: input.idempotencyKey,
          metadata: { requestFingerprint, presenceStatus },
        },
        include: { checkpoint: true },
      });

      return { event, presenceStatus };
    });

    if ("replay" in location) return location.replay;
    return this.toResponse(location.event, location.presenceStatus);
  }

  async getMyStatus(user: AuthenticatedUser) {
    const session = await this.prisma.attendanceSession.findFirst({
      where: { userId: user.id, status: AttendanceSessionStatus.OPEN },
      include: { policy: true },
    });
    if (!session) {
      return {
        success: true,
        data: { profileType: this.getProfileType(user.accountType), sessionStatus: null, presenceStatus: "INSIDE" },
      };
    }

    const deadlineAt = session.policy
      ? new Date(session.exitAt.getTime() + session.policy.overdueAfterMinutes * 60_000)
      : null;
    const presenceStatus = deadlineAt && Date.now() > deadlineAt.getTime() ? "OVERDUE" : "OUTSIDE";
    return {
      success: true,
      data: {
        profileType: session.profileType,
        sessionStatus: session.status,
        presenceStatus,
        exitAt: session.exitAt.toISOString(),
        returnAt: null,
        deadlineAt: deadlineAt?.toISOString() ?? null,
      },
    };
  }

  async getMyHistory(user: AuthenticatedUser, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [sessions, total] = await this.prisma.$transaction([
      this.prisma.attendanceSession.findMany({
        where: { userId: user.id },
        orderBy: { exitAt: "desc" },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: {
          events: {
            orderBy: { recordedAt: "asc" },
            include: { checkpoint: { select: { name: true } } },
          },
        },
      }),
      this.prisma.attendanceSession.count({ where: { userId: user.id } }),
    ]);

    return {
      success: true,
      data: sessions.map((session) => ({
        sessionId: session.id,
        exitAt: session.exitAt.toISOString(),
        returnAt: session.returnAt?.toISOString() ?? null,
        sessionStatus: session.status,
        events: session.events.map((event) => ({
          eventType: event.eventType,
          checkpointName: event.checkpoint.name,
        })),
      })),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  private async resolvePolicy(
    transaction: Prisma.TransactionClient,
    userId: string,
    profileType: ProfileType,
    now: Date,
  ) {
    const assignment = await transaction.organizationAssignment.findFirst({
      where: {
        userId,
        isPrimary: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: { startDate: "desc" },
    });
    const policies = await transaction.attendancePolicy.findMany({
      where: {
        isActive: true,
        OR: [{ profileType: null }, { profileType }],
        effectiveFrom: { lte: now },
        AND: [{ OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }] }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    const eligible = policies
      .filter((policy) => !policy.unitId || policy.unitId === assignment?.unitId)
      .filter((policy) => !policy.organizationId || policy.organizationId === assignment?.organizationId)
      .sort((left, right) => this.policyScore(right, profileType) - this.policyScore(left, profileType));
    return eligible[0] ?? null;
  }

  private policyScore(policy: { unitId: string | null; organizationId: string | null; profileType: ProfileType | null }, profileType: ProfileType) {
    return Number(Boolean(policy.unitId)) * 4 +
      Number(Boolean(policy.organizationId)) * 2 +
      Number(policy.profileType === profileType);
  }

  private getProfileType(accountType: string): ProfileType {
    if (accountType === "MILITARY" || accountType === "PERSIT") return accountType;
    throw new ForbiddenException({ code: "PERMISSION_DENIED" });
  }

  private requestFingerprint(userId: string, input: AttendanceScanDto): string {
    return createHash("sha256")
      .update(JSON.stringify({ userId, ...input }))
      .digest("hex");
  }

  private returnReplay(
    event: Prisma.AttendanceEventGetPayload<{ include: { checkpoint: true } }>,
    userId: string,
    requestFingerprint: string,
  ) {
    const metadata = event.metadata as Prisma.JsonObject | null;
    if (
      event.userId !== userId ||
      !metadata ||
      metadata.requestFingerprint !== requestFingerprint
    ) {
      throw new ConflictException({ code: "DUPLICATE_REQUEST" });
    }
    return this.toResponse(event, String(metadata.presenceStatus ?? "OUTSIDE"));
  }

  private toResponse(event: Prisma.AttendanceEventGetPayload<{ include: { checkpoint: true } }>, presenceStatus: string) {
    return {
      success: true,
      message: `Berhasil melakukan ${event.eventType}`,
      data: {
        eventId: event.id,
        sessionId: event.sessionId,
        eventType: event.eventType,
        profileType: event.profileType,
        presenceStatus,
        recordedAt: event.recordedAt.toISOString(),
        checkpoint: {
          id: event.checkpoint.id,
          code: event.checkpoint.code,
          name: event.checkpoint.name,
        },
        locationValidation: {
          valid: event.validationStatus === "VALID",
          distanceMeter: Number(event.distanceMeter ?? 0),
          accuracy: Number(event.accuracy),
        },
      },
    };
  }
}