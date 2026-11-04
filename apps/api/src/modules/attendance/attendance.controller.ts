import { Body, Controller, Get, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AttendanceScanDto } from "./dto/attendance-scan.dto";
import { AttendanceService } from "./attendance.service";

@ApiTags("attendance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post("scan")
  @RequirePermissions("attendance.scan")
  scan(@Req() request: Request, @Body() dto: AttendanceScanDto) {
    return this.attendance.scan(request.user!, dto);
  }

  @Get("my-status")
  getMyStatus(@Req() request: Request) {
    return this.attendance.getMyStatus(request.user!);
  }

  @Get("my-history")
  getMyHistory(
    @Req() request: Request,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.attendance.getMyHistory(request.user!, page, limit);
  }
}