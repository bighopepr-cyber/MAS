import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import {
  AssignPermissionsDto,
  AssignRoleDto,
  CreatePermissionDto,
  CreateRoleDto,
  DirectPermissionDto,
  UpdateRoleDto,
} from "./dto/rbac.dto";
import { RbacService } from "./rbac.service";

@ApiTags("roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("roles")
export class RolesController {
  constructor(private readonly rbac: RbacService) {}

  @Get()
  @RequirePermissions("rbac.role.view")
  list() { return this.rbac.listRoles(); }

  @Post()
  @RequirePermissions("rbac.role.create")
  create(@Body() dto: CreateRoleDto) { return this.rbac.createRole(dto); }

  @Patch(":id")
  @RequirePermissions("rbac.role.update")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rbac.updateRole(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("rbac.role.delete")
  delete(@Param("id", ParseUUIDPipe) id: string) { return this.rbac.deleteRole(id); }

  @Get(":id/permissions")
  @RequirePermissions("rbac.permission.view")
  getPermissions(@Param("id", ParseUUIDPipe) id: string) { return this.rbac.getRolePermissions(id); }

  @Put(":id/permissions")
  @RequirePermissions("rbac.permission.assign")
  assignPermissions(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AssignPermissionsDto) {
    return this.rbac.assignPermissions(id, dto);
  }
}

@ApiTags("permissions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly rbac: RbacService) {}

  @Get()
  @RequirePermissions("rbac.permission.view")
  list() { return this.rbac.getPermissions(); }

  @Post()
  @RequirePermissions("rbac.permission.create")
  create(@Body() dto: CreatePermissionDto) { return this.rbac.createPermission(dto); }
}

@ApiTags("user roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users/:userId/roles")
export class UserRolesController {
  constructor(private readonly rbac: RbacService) {}

  @Get()
  @RequirePermissions("user.view")
  list(@Param("userId", ParseUUIDPipe) userId: string) { return this.rbac.listUserRoles(userId); }

  @Post()
  @RequirePermissions("rbac.role.assign")
  assign(@Param("userId", ParseUUIDPipe) userId: string, @Body() dto: AssignRoleDto, @Req() request: Request) {
    return this.rbac.assignRole(userId, dto, request.user!.id);
  }

  @Delete(":roleId")
  @RequirePermissions("rbac.role.assign")
  remove(@Param("userId", ParseUUIDPipe) userId: string, @Param("roleId", ParseUUIDPipe) roleId: string) {
    return this.rbac.removeRole(userId, roleId);
  }
}

@ApiTags("user permissions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users/:userId/permissions")
export class UserPermissionsController {
  constructor(private readonly rbac: RbacService) {}

  @Post()
  @RequirePermissions("rbac.permission.assign")
  assign(@Param("userId", ParseUUIDPipe) userId: string, @Body() dto: DirectPermissionDto, @Req() request: Request) {
    return this.rbac.assignDirectPermission(userId, dto.permissionId, dto.effect, request.user!.id);
  }
}