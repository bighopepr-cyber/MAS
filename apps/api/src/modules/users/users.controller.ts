import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CreateUserDto } from "./dto/create-user.dto";
import { ResetPinDto } from "./dto/reset-pin.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  current(@Req() request: Request) {
    return { success: true, data: request.user };
  }

  @Get()
  @RequirePermissions("user.view")
  list(
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.users.list(page, limit);
  }

  @Post()
  @RequirePermissions("user.create")
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get(":id")
  @RequirePermissions("user.view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.users.getById(id);
  }

  @Post(":id/reset-pin")
  @RequirePermissions("user.reset-pin")
  resetPin(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ResetPinDto) {
    return this.users.resetPin(id, dto.newPin);
  }
}