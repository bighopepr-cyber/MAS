import { Body, Controller, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePinDto, RefreshTokenDto } from "./dto/token.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.auth.refresh(dto.refreshToken, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("logout")
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Patch("change-pin")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  changePin(@Body() dto: ChangePinDto, @Req() request: Request) {
    return this.auth.changePin(request.user!.id, dto.currentPin, dto.newPin);
  }
}