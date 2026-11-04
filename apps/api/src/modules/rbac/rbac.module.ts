import { Module } from "@nestjs/common";
import { AuthModule } from "../identity-access/auth.module";
import { PermissionsController, RolesController, UserPermissionsController, UserRolesController } from "./rbac.controller";
import { RbacService } from "./rbac.service";

@Module({
  imports: [AuthModule],
  controllers: [RolesController, PermissionsController, UserRolesController, UserPermissionsController],
  providers: [RbacService],
})
export class RbacModule {}