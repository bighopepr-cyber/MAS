import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CreateAttendancePolicyDto } from "./dto/attendance-policy.dto";
import { AttendancePoliciesService } from "./attendance-policies.service";

@ApiTags("attendance policies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("attendance-policies")
export class AttendancePoliciesController {
  constructor(private readonly policies: AttendancePoliciesService) {}

  @Get()
  @RequirePermissions("attendance.policy.view")
  list() { return this.policies.list(); }

  @Get("effective")
  @RequirePermissions("attendance.policy.view")
  effective(@Query("profileType") profileType: string, @Req() request: Request) {
    return this.policies.effective(profileType, request.user!);
  }

  @Post()
  @RequirePermissions("attendance.policy.manage")
  create(@Body() dto: CreateAttendancePolicyDto, @Req() request: Request) {
    return this.policies.create(request.user!, dto);
  }

  @Patch(":id")
  @RequirePermissions("attendance.policy.manage")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: Partial<CreateAttendancePolicyDto>) {
    return this.policies.update(id, dto);
  }
}