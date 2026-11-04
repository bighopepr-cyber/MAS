import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CreateCheckpointDto } from "./dto/create-checkpoint.dto";
import { CheckpointsService } from "./checkpoints.service";
import { Req } from "@nestjs/common";

@ApiTags("checkpoints")
@Controller("checkpoints")
export class CheckpointsController {
  constructor(private readonly checkpoints: CheckpointsService) {}

  @Get("qr/:token")
  validateQr(@Param("token") token: string) {
    return this.checkpoints.validateQr(token);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("checkpoint.view")
  list() {
    return this.checkpoints.list();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("checkpoint.create")
  create(@Body() dto: CreateCheckpointDto) {
    return this.checkpoints.create(dto);
  }

  @Post(":id/qr")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("checkpoint.qr.generate")
  generateQr(@Param("id", ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.checkpoints.generateQr(id, request.user!.id);
  }

  @Post(":id/qr/revoke")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("checkpoint.qr.revoke")
  revokeQr(@Param("id", ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.checkpoints.revokeQr(id, body.reason ?? "QR dicabut oleh administrator");
  }
}