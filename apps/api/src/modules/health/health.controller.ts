import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Status proses API" })
  getHealth(): object {
    return {
      success: true,
      data: { status: "UP", timestamp: new Date().toISOString() },
    };
  }

  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  getLiveness(): object {
    return { success: true, data: { status: "UP" } };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe database" })
  async getReadiness(): Promise<object> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        success: true,
        data: {
          status: "UP",
          database: "UP",
          timestamp: new Date().toISOString(),
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        success: false,
        data: { status: "DOWN", database: "DOWN" },
      });
    }
  }
}