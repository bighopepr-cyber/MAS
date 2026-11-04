import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { Prisma } from "@mas/database";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccessContextService } from "./access-context.service";
import type { LoginDto } from "./dto/login.dto";

interface RefreshClaims {
  sub: string;
  sid: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly accessContext: AccessContextService,
  ) {}

  async login(dto: LoginDto, metadata: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.identity },
      include: { militaryProfile: true, persitProfile: true },
    });

    let pinMatches = false;
    if (user) {
      try {
        pinMatches = await argon2.verify(user.pinHash, dto.pin);
      } catch {
        pinMatches = false;
      }
    }

    if (!user || !pinMatches) {
      await this.recordLoginFailure(user?.id, metadata.ip);
      throw new UnauthorizedException({ code: "AUTH_INVALID_CREDENTIALS" });
    }
    if (!user.isActive || user.deletedAt) {
      await this.recordLoginFailure(user.id, metadata.ip, "ACCOUNT_INACTIVE");
      throw new ForbiddenException({ code: "ACCOUNT_INACTIVE" });
    }

    const device = dto.device
      ? await this.prisma.userDevice.upsert({
          where: {
            userId_deviceFingerprint: {
              userId: user.id,
              deviceFingerprint: dto.device.deviceId,
            },
          },
          create: {
            userId: user.id,
            deviceFingerprint: dto.device.deviceId,
            deviceName: dto.device.deviceName,
            platform: dto.device.platform,
            lastSeenAt: new Date(),
          },
          update: {
            deviceName: dto.device.deviceName,
            platform: dto.device.platform,
            isActive: true,
            lastSeenAt: new Date(),
          },
        })
      : null;

    const sessionId = randomUUID();
    const tokens = await this.createTokenPair(user.id, sessionId);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      }),
      this.prisma.userSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash: this.hashToken(tokens.refreshToken),
          deviceId: device?.id,
          ipAddress: metadata.ip,
          userAgent: metadata.userAgent,
          expiresAt: new Date(now.getTime() + this.refreshTtlSeconds() * 1000),
        },
      }),
    ]);

    const access = await this.accessContext.load(user.id);
    const profile = user.militaryProfile
      ? { fullName: user.militaryProfile.fullName, nrp: user.militaryProfile.nrp }
      : user.persitProfile
        ? { fullName: user.persitProfile.fullName, memberNumber: user.persitProfile.memberNumber }
        : null;

    return {
      success: true,
      message: "Login berhasil",
      data: {
        ...tokens,
        expiresIn: this.accessTtlSeconds(),
        user: {
          id: user.id,
          username: user.username,
          accountType: user.accountType,
          profile,
          roles: access.roles.map((name) => ({ name })),
          permissions: access.permissions,
        },
      },
    };
  }

  async refresh(refreshToken: string, metadata: { ip?: string; userAgent?: string }) {
    const claims = await this.verifyRefreshToken(refreshToken);
    const existing = await this.prisma.userSession.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    const now = new Date();
    if (
      !existing ||
      existing.userId !== claims.sub ||
      existing.revokedAt ||
      existing.expiresAt <= now ||
      !this.equalHash(existing.refreshTokenHash, this.hashToken(refreshToken)) ||
      !existing.user.isActive ||
      existing.user.deletedAt
    ) {
      throw new UnauthorizedException({ code: "TOKEN_EXPIRED" });
    }

    const nextSessionId = randomUUID();
    const tokens = await this.createTokenPair(existing.userId, nextSessionId);
    const expiresAt = new Date(now.getTime() + this.refreshTtlSeconds() * 1000);

    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.userSession.updateMany({
        where: { id: existing.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (revoked.count !== 1) {
        throw new UnauthorizedException({ code: "TOKEN_EXPIRED" });
      }
      await transaction.userSession.create({
        data: {
          id: nextSessionId,
          userId: existing.userId,
          refreshTokenHash: this.hashToken(tokens.refreshToken),
          deviceId: existing.deviceId,
          ipAddress: metadata.ip,
          userAgent: metadata.userAgent,
          expiresAt,
        },
      });
    });

    return {
      success: true,
      message: "Token berhasil diperbarui",
      data: { ...tokens, expiresIn: this.accessTtlSeconds() },
    };
  }

  async logout(refreshToken: string): Promise<object> {
    try {
      const claims = await this.verifyRefreshToken(refreshToken);
      const session = await this.prisma.userSession.findUnique({ where: { id: claims.sid } });
      if (
        session &&
        session.userId === claims.sub &&
        !session.revokedAt &&
        this.equalHash(session.refreshTokenHash, this.hashToken(refreshToken))
      ) {
        await this.prisma.userSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Logout remains idempotent when a token has already expired or been revoked.
    }
    return { success: true, message: "Logout berhasil", data: null };
  }

  async changePin(userId: string, currentPin: string, newPin: string): Promise<object> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.pinHash, currentPin))) {
      throw new UnauthorizedException({ code: "AUTH_INVALID_CREDENTIALS" });
    }
    if (!/^\d{4,12}$/.test(newPin)) {
      throw new BadRequestException({ code: "VALIDATION_ERROR" });
    }

    const pinHash = await argon2.hash(newPin, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { pinHash } }),
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true, message: "PIN berhasil diubah", data: null };
  }

  private async createTokenPair(userId: string, sessionId: string) {
    const accessOptions: JwtSignOptions = {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m") as JwtSignOptions["expiresIn"],
    };
    const refreshOptions: JwtSignOptions = {
      secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.config.get<string>("JWT_REFRESH_TTL", "7d") as JwtSignOptions["expiresIn"],
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ sub: userId }, accessOptions),
      this.jwt.signAsync({ sub: userId, sid: sessionId }, refreshOptions),
    ]);
    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshClaims> {
    try {
      return await this.jwt.verifyAsync<RefreshClaims>(token, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException({ code: "TOKEN_EXPIRED" });
    }
  }

  private async recordLoginFailure(userId?: string, ip?: string, reason = "INVALID_CREDENTIALS") {
    await this.prisma.securityEvent.create({
      data: {
        userId,
        eventType: "LOGIN_FAILURE",
        severity: "LOW",
        source: "AUTH",
        metadata: { reason, ipAddress: ip ?? null } as Prisma.InputJsonValue,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private equalHash(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private accessTtlSeconds(): number {
    return this.parseDuration(this.config.get<string>("JWT_ACCESS_TTL", "15m"));
  }

  private refreshTtlSeconds(): number {
    return this.parseDuration(this.config.get<string>("JWT_REFRESH_TTL", "7d"));
  }

  private parseDuration(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(value);
    if (!match) throw new Error("JWT TTL harus menggunakan format seperti 15m atau 7d.");
    const amount = Number(match[1]);
    const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return amount * unitSeconds[match[2]];
  }
}