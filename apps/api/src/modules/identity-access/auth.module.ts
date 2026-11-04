import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AccessContextService } from "./access-context.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AccessContextService, JwtAuthGuard, PermissionsGuard],
  exports: [JwtModule, AuthService, AccessContextService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}